import mongoose from "mongoose";
import { Application, type ApplicationDoc } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { User } from "../../models/User.model";
import { EmailNotification, type EmailNotificationDoc, type RejectionSnapshot } from "../../models/EmailNotification.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { getAccessibleApplication, getAccessibleApplicationForActiveJob } from "../applications/applicationAccess.service";
import { TERMINAL_STATUSES, TERMINAL_STATE_MESSAGE } from "../stageTransitions/stageTransition.service";
import { attemptEmailDelivery } from "../../services/email/emailNotificationDelivery.service";
import type { EmailContent } from "../../services/email/email.types";
import { buildApplicationRejectionEmail } from "../../services/email/templates/applicationRejection.template";
import type { RejectApplicationInput } from "./rejection.validation";
import { serializeRejectionInfo, type RejectionInfoDTO } from "./rejection.serializer";

const NOT_RETRYABLE_MESSAGE = "Only a failed rejection email can be retried.";
const CONCURRENT_REJECT_MESSAGE = "This application was just updated by someone else. Please refresh and try again.";
const NO_REJECTION_EMAIL_MESSAGE = "No rejection email was sent for this application.";

export interface RejectApplicationResult {
  application: ApplicationDoc;
  notification: EmailNotificationDoc | null;
}

function buildContentFromSnapshot(snapshot: RejectionSnapshot): EmailContent {
  return buildApplicationRejectionEmail({
    candidateName: snapshot.candidate_name,
    companyName: snapshot.company_name,
    jobTitle: snapshot.job_title,
  });
}

/**
 * Explicit "Reject Candidate" action — HR/Admin only (see
 * rejection.routes.ts). Uses the ACTIVE-Job variant (blocks soft-deleted
 * Job, allows a merely closed one) — rejecting an existing applicant is an
 * active hiring-workflow action, same lifecycle rule as assessment
 * creation and offer creation.
 *
 * Contract (hardened after a real bug — see offerEmail.service.ts's
 * sendOffer for the sibling fix this mirrors exactly):
 *
 *   send_email === false: a single, non-transactional, optimistically-
 *   guarded Application update. No notification is required or created.
 *
 *   send_email === true: the Application update AND the pending
 *   EmailNotification row are created together, inside ONE transaction.
 *   Either both commit or neither does — there is no way to end up with
 *   Application.status === "rejected" and zero persisted notification
 *   history for a rejection HR explicitly asked to email. If
 *   EmailNotification.create() fails for any reason, the WHOLE
 *   transaction aborts, including the Application update — HR simply
 *   retries the "Reject Candidate" action from a clean, non-terminal
 *   state. (Contrast with SMTP delivery itself, attempted AFTER the
 *   transaction commits: a delivery failure NEVER rolls back anything —
 *   only a failure to durably PERSIST the notification event does.)
 */
export async function rejectApplication(
  companyId: string,
  userId: string,
  applicationId: string,
  input: RejectApplicationInput
): Promise<RejectApplicationResult> {
  const application = await getAccessibleApplicationForActiveJob(applicationId, companyId);

  if (TERMINAL_STATUSES.has(application.status)) {
    throw new ConflictError(TERMINAL_STATE_MESSAGE);
  }

  const rejectionFields = {
    status: "rejected" as const,
    final_decision: "rejected" as const,
    rejected_at: new Date(),
    rejected_by_user_id: userId,
    rejection_reason: input.internal_reason ?? null,
  };

  if (!input.send_email) {
    // Atomic, guarded by the EXACT status this call observed — a
    // concurrent second reject (or any other status-changing action)
    // racing this one finds nothing left to match and safely conflicts
    // rather than silently overwriting/duplicating the rejection (see
    // this ticket's explicit Part 24 "double Reject" concurrency
    // requirement).
    const updatedApplication = await Application.findOneAndUpdate(
      { _id: applicationId, status: application.status },
      { $set: rejectionFields },
      { new: true }
    );
    if (!updatedApplication) {
      throw new ConflictError(CONCURRENT_REJECT_MESSAGE);
    }
    return { application: updatedApplication, notification: null };
  }

  const [candidate, job] = await Promise.all([
    Candidate.findById(application.candidate_id).select("full_name email"),
    Job.findById(application.job_id).select("title company_id"),
  ]);
  // Defensive only — candidate_id/job_id are required fields and neither
  // is ever hard-deleted. Falls back to the plain, notification-less path
  // above rather than blocking the rejection itself on a state that
  // should be unreachable in practice.
  if (!candidate || !job) {
    const updatedApplication = await Application.findOneAndUpdate(
      { _id: applicationId, status: application.status },
      { $set: rejectionFields },
      { new: true }
    );
    if (!updatedApplication) {
      throw new ConflictError(CONCURRENT_REJECT_MESSAGE);
    }
    return { application: updatedApplication, notification: null };
  }
  const company = await Company.findById(job.company_id).select("name");

  const snapshot: RejectionSnapshot = {
    candidate_name: candidate.full_name,
    company_name: company?.name ?? "the hiring company",
    job_title: job.title,
  };
  const content = buildContentFromSnapshot(snapshot);

  const session = await mongoose.startSession();
  let updatedApplication: ApplicationDoc;
  let notification: EmailNotificationDoc;
  try {
    let result: { application: ApplicationDoc; notification: EmailNotificationDoc } | undefined;

    await session.withTransaction(async () => {
      const updated = await Application.findOneAndUpdate(
        { _id: applicationId, status: application.status },
        { $set: rejectionFields },
        { new: true, session }
      );
      if (!updated) {
        throw new ConflictError(CONCURRENT_REJECT_MESSAGE);
      }

      // Created durably WITH the Application transition — never after it
      // (see this function's own doc comment). If this throws for any
      // reason, including the defensive duplicate-key case below, the
      // whole transaction aborts and the Application update above is
      // rolled back with it — there is no way to end up "rejected" with
      // zero persisted notification history for a rejection HR asked to
      // email.
      const [createdNotification] = await EmailNotification.create(
        [
          {
            company_id: companyId,
            application_id: updated.id,
            candidate_id: candidate.id,
            category: "application_rejection",
            recipient_email: candidate.email,
            subject: content.subject,
            rejection_snapshot: snapshot,
            status: "pending",
            triggered_by_user_id: userId,
            // Compatibility value ONLY — see EmailNotification.model.ts's
            // own doc comment. This is NOT application_rejection's
            // idempotency mechanism (that's the Application's own atomic
            // non-terminal->rejected transition guard just above, which
            // makes this create() call reachable at most once per
            // Application ever, since rejected is terminal). Without a
            // genuinely distinct value here, every rejection notification
            // system-wide would collide on the pre-existing
            // {interview_id, category, mutation_version_at} unique index.
            mutation_version_at: new Date(),
          },
        ],
        { session }
      );

      result = { application: updated, notification: createdNotification! };
    });

    updatedApplication = result!.application;
    notification = result!.notification;
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Defense-in-depth only — the Application's own atomic guard above
      // is the real double-reject protection (only one concurrent request
      // could ever reach this far for the same Application), so this
      // branch should be unreachable in practice. Since the create() now
      // runs inside the transaction, this also aborts the Application
      // update in the same request, consistent with "either all writes
      // commit or none do".
      throw new ConflictError(CONCURRENT_REJECT_MESSAGE);
    }
    throw err;
  } finally {
    await session.endSession();
  }

  await attemptEmailDelivery(notification, content);
  return { application: updatedApplication, notification };
}

/**
 * Explicit "Retry Email" for a failed rejection notice — retries the SAME
 * row in place (there is at most one application_rejection row per
 * Application ever, since an Application can only be rejected once),
 * rendering from its own immutable rejection_snapshot, never from a fresh
 * Candidate/Job/Company lookup.
 */
export async function retryRejectionEmail(companyId: string, applicationId: string): Promise<EmailNotificationDoc> {
  const notification = await EmailNotification.findOne({
    application_id: applicationId,
    company_id: companyId,
    category: "application_rejection",
  }).sort({ created_at: -1 });
  if (!notification) {
    throw new NotFoundError(NO_REJECTION_EMAIL_MESSAGE);
  }
  if (notification.status !== "failed") {
    throw new ConflictError(NOT_RETRYABLE_MESSAGE);
  }

  const content = buildContentFromSnapshot(notification.rejection_snapshot!);
  await attemptEmailDelivery(notification, content);
  return notification;
}

/**
 * Rejection audit info for the Application Detail page's "Rejected" state
 * — uses the HISTORICAL access variant (works after Job soft-delete),
 * matching every other read of terminal-outcome data meant to remain
 * available as audit history. Returns null fields (never throws) for an
 * Application that isn't actually rejected — the frontend only calls this
 * once it already knows status === "rejected", but this stays safe either way.
 */
export async function getRejectionInfo(companyId: string, applicationId: string): Promise<RejectionInfoDTO> {
  const application = await getAccessibleApplication(applicationId, companyId);

  const [rejectedByUser, notification] = await Promise.all([
    application.rejected_by_user_id ? User.findById(application.rejected_by_user_id).select("name") : Promise.resolve(null),
    EmailNotification.findOne({ application_id: applicationId, category: "application_rejection" })
      .sort({ created_at: -1 })
      .select("status"),
  ]);

  return serializeRejectionInfo(application, rejectedByUser?.name ?? null, notification?.status ?? null);
}
