import { Candidate, type CandidateDoc } from "../../models/Candidate.model";
import { Application } from "../../models/Application.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { BadRequestError, ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { cvStorage } from "../../services/storage/cvStorage.service";
import { emailService } from "../../services/email/email.service";
import { buildApplicationConfirmationEmail } from "../../services/email/templates/applicationConfirmation.template";
import { triggerInitialScreeningInBackground } from "../../services/ai/screeningRun.service";
import { detectCvFileType } from "./cvFileSignature";
import type { SubmitApplicationInput } from "./application.validation";

export interface CvFileInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

/**
 * Candidate-identity rule (ERD/BRD do not define one — flagged, not
 * invented silently): a candidate is identified globally by email. If a
 * Candidate with this email already exists, it is reused as-is for the new
 * application; its stored profile fields are NOT overwritten with this
 * submission's values. This keeps a failed/duplicate application attempt
 * from having a side effect on existing data, and avoids merging two
 * different people who happen to reuse an email into one record based on
 * only the newest submission being "correct".
 *
 * Handles the create-race safely: if two requests for the same new email
 * arrive concurrently, the loser's insert fails on the unique index and is
 * resolved by re-reading the winner's document rather than erroring.
 */
async function findOrCreateCandidate(input: SubmitApplicationInput): Promise<CandidateDoc> {
  const existing = await Candidate.findOne({ email: input.email });
  if (existing) {
    return existing;
  }

  try {
    return await Candidate.create({
      full_name: input.full_name,
      email: input.email,
      phone: input.phone,
      location: input.location,
      linkedin_url: input.linkedin_url,
      portfolio_url: input.portfolio_url,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      const raceWinner = await Candidate.findOne({ email: input.email });
      if (raceWinner) return raceWinner;
    }
    throw err;
  }
}

/**
 * Sends the candidate their application-confirmation email. Deliberately
 * never throws: the Application is the primary business operation and has
 * already succeeded by the time this runs, so a delivery failure here must
 * never affect the response or roll back anything already persisted. Never
 * logs SMTP credentials or CV contents — only ids, for operator triage.
 */
async function sendApplicationConfirmationEmail(params: {
  candidate: CandidateDoc;
  jobId: string;
  jobTitle: string;
  companyId: string;
}): Promise<void> {
  try {
    const company = await Company.findById(params.companyId).select("name").lean();

    const { subject, text, html } = buildApplicationConfirmationEmail({
      candidateName: params.candidate.full_name,
      jobTitle: params.jobTitle,
      companyName: company?.name ?? "the hiring company",
    });

    await emailService.send({ to: params.candidate.email, subject, text, html });
  } catch (err) {
    console.error("[email] failed to send application confirmation", {
      candidateId: params.candidate._id.toString(),
      jobId: params.jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function submitPublicApplication(
  jobId: string,
  input: SubmitApplicationInput,
  cvFile: CvFileInput
): Promise<void> {
  // 1-2: only an active, non-deleted job can be applied to at all.
  // Draft/closed/soft-deleted/nonexistent are all identical 404s — the
  // query is scoped to status: "active" and NOT_DELETED_JOB_FILTER
  // directly, not fetched then checked, so a non-public job's existence
  // (including a soft-deleted one whose status somehow remains "active")
  // is never revealed here either.
  const job = await Job.findOne({ _id: jobId, status: "active", ...NOT_DELETED_JOB_FILTER }).select(
    "_id title company_id"
  );
  if (!job) {
    throw new NotFoundError("Job not found");
  }

  // 3: candidate form fields were already validated by Zod before this
  // function is called.

  // 4: authoritative content check — file.mimetype/originalname were only
  // ever a cheap pre-filter (see upload.middleware.ts); this is what
  // actually confirms the bytes are a real PDF/DOCX.
  const detectedType = await detectCvFileType(cvFile.buffer);
  if (!detectedType) {
    throw new BadRequestError("The uploaded file is not a valid PDF or DOCX document.");
  }

  // 5: resolve candidate identity.
  //
  // No transaction wraps any of this: see task report for why. In short,
  // a Candidate created without a following Application is not a data
  // integrity problem — Candidate has no required back-reference to any
  // Application, so it's simply a valid, inert record, and a retried
  // request naturally reuses it via the unique email index instead of
  // duplicating it.
  const candidate = await findOrCreateCandidate(input);

  // 6-7: pre-check for the common duplicate case BEFORE spending an
  // external upload on it. This does not replace the database-level
  // unique index below — it only avoids the upload+cleanup round trip for
  // the non-race case, which is the normal one.
  const alreadyApplied = await Application.exists({ job_id: job._id, candidate_id: candidate._id });
  if (alreadyApplied) {
    throw new ConflictError("You have already applied to this position.");
  }

  // 8: upload the validated CV.
  const uploaded = await cvStorage.upload({
    buffer: cvFile.buffer,
    originalName: cvFile.originalName,
    mimeType: cvFile.mimeType,
  });

  // 9: create the Application. If this fails for any reason — including
  // losing the rare concurrent-duplicate race that step 6's pre-check
  // can't catch — the upload we just made is now orphaned and must be
  // cleaned up rather than left behind.
  let application;
  try {
    application = await Application.create({
      job_id: job._id,
      candidate_id: candidate._id,
      status: "applied",
      source: "public_job_page",
      applied_at: new Date(),
      cv_file: {
        storage_key: uploaded.storage_key,
        original_name: uploaded.original_name,
        mime_type: uploaded.mime_type,
        size_bytes: uploaded.size_bytes,
      },
    });
  } catch (err) {
    await cvStorage.delete(uploaded.storage_key).catch((cleanupErr: unknown) => {
      // Best-effort cleanup; a failure here must not mask the original
      // error, but it also must not be silent — an operator needs to know
      // an orphaned CV may exist in storage.
      console.error("[cvStorage] failed to clean up orphaned upload", uploaded.storage_key, cleanupErr);
    });

    if (isDuplicateKeyError(err)) {
      throw new ConflictError("You have already applied to this position.");
    }
    throw err;
  }

  // The Application is now the source of truth and has already succeeded
  // — email is purely a notification side effect from here on. It never
  // throws (see sendApplicationConfirmationEmail), so this can't affect
  // the response the controller sends next.
  await sendApplicationConfirmationEmail({
    candidate,
    jobId: job._id.toString(),
    jobTitle: job.title,
    companyId: job.company_id.toString(),
  });

  // Initial AI screening starts automatically here, exactly once, for
  // every successfully created Application — deliberately NOT awaited:
  // the candidate's response must not wait for a multi-second CV-
  // extraction + AI round trip (this ticket's explicit latency rule).
  // triggerInitialScreeningInBackground is a plain synchronous function
  // that starts its own Promise chain with an always-attached `.catch`,
  // so this can never become an unhandled rejection, and no AI failure
  // here can ever roll back or fail the Application that already exists
  // (see screeningRun.service.ts's own doc comment for the full
  // one-time/concurrency contract and its documented limitations).
  triggerInitialScreeningInBackground(application.id, job._id.toString());

  // 10: the controller sends the minimal success response.
}
