import { Types } from "mongoose";
import {
  EmailNotification,
  emailNotificationIdentifierFilter,
  type AssessmentSnapshot,
  type EmailNotificationDoc,
  type EmailNotificationStatus,
} from "../../models/EmailNotification.model";
import {
  ApplicationAssessment,
  applicationAssessmentIdentifierFilter,
  type ApplicationAssessmentDoc,
} from "../../models/ApplicationAssessment.model";
import { Application } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { attemptEmailDelivery } from "../../services/email/emailNotificationDelivery.service";
import type { EmailContent } from "../../services/email/email.types";
import { buildAssessmentInvitationEmail } from "../../services/email/templates/assessmentInvitation.template";

const NOT_RETRYABLE_MESSAGE = "Only failed notifications can be retried.";
const JOB_DELETED_MESSAGE = "Job not found";
const SEND_IN_PROGRESS_MESSAGE = "An assessment invitation is already being sent for this assessment.";

interface AssessmentEmailContext {
  companyId: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
}

/**
 * Resolves everything needed to construct a NEW assessment_snapshot at the
 * moment a send is attempted — live data, on purpose (mirrors
 * interviewNotification.service.ts's resolveNotificationContext exactly).
 * Returns null (never throws) if any required piece is missing.
 */
async function resolveAssessmentEmailContext(assessment: ApplicationAssessmentDoc): Promise<AssessmentEmailContext | null> {
  const application = await Application.findById(assessment.application_id).select("candidate_id");
  if (!application) return null;

  const candidate = await Candidate.findById(application.candidate_id).select("full_name email");
  if (!candidate) return null;

  const job = await Job.findById(assessment.job_id).select("title company_id");
  if (!job) return null;

  const company = await Company.findById(job.company_id).select("name");

  return {
    companyId: job.company_id.toString(),
    applicationId: application.id,
    candidateId: candidate.id,
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    jobTitle: job.title,
    companyName: company?.name ?? "the hiring company",
  };
}

/**
 * Freezes the facts THIS ONE email event actually says — see
 * EmailNotification.model.ts's assessmentSnapshotSchema doc comment for
 * why this must never be re-derived from live data again. If HR edits
 * external_url AFTER this event, retrying THIS notification must still
 * use what was true when it was sent — a corrected link only ever goes
 * out via a brand-new, explicit "Send Again" (which freezes its own fresh
 * snapshot at that later moment).
 */
function buildAssessmentSnapshot(assessment: ApplicationAssessmentDoc, ctx: AssessmentEmailContext): AssessmentSnapshot {
  return {
    candidate_name: ctx.candidateName,
    company_name: ctx.companyName,
    job_title: ctx.jobTitle,
    assessment_name: assessment.name,
    external_url: assessment.external_url,
  };
}

function buildContentFromSnapshot(snapshot: AssessmentSnapshot): EmailContent {
  return buildAssessmentInvitationEmail({
    candidateName: snapshot.candidate_name,
    companyName: snapshot.company_name,
    jobTitle: snapshot.job_title,
    assessmentName: snapshot.assessment_name,
    externalUrl: snapshot.external_url,
  });
}

/**
 * Explicit "Send Assessment" / "Send Again" action — HR/Admin only, never
 * triggered automatically by creating/editing the assessment record (see
 * this ticket's explicit Part 8/17). Always creates a brand-new
 * EmailNotification row with a FRESH snapshot of the assessment's CURRENT
 * name/external_url — this is the one place a corrected link actually
 * reaches the candidate. Blocked once the Job is soft-deleted (new sends
 * are an active hiring-workflow action, matching Part 29); NOT blocked for
 * a merely closed Job (existing candidate processing continues, same
 * lifecycle rule as everywhere else in this codebase).
 *
 * Double-click protection: EmailNotification.model.ts's partial unique
 * index on (application_assessment_id, category) WHERE status: "pending"
 * means a concurrent second call's own create() collides with this one's
 * still-pending row and is treated as "already in flight" — a safe 409,
 * never a second email.
 */
export async function sendAssessmentInvitation(
  companyId: string,
  userId: string,
  assessmentId: string
): Promise<EmailNotificationDoc> {
  const assessment = await ApplicationAssessment.findOne({
    ...applicationAssessmentIdentifierFilter(assessmentId),
    company_id: companyId,
  });
  if (!assessment) {
    throw new NotFoundError("Assessment not found");
  }

  const job = await Job.findOne({ _id: assessment.job_id, ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError(JOB_DELETED_MESSAGE);
  }

  const context = await resolveAssessmentEmailContext(assessment);
  if (!context) {
    throw new NotFoundError("Assessment not found");
  }

  const snapshot = buildAssessmentSnapshot(assessment, context);
  const content = buildContentFromSnapshot(snapshot);

  let notification: EmailNotificationDoc;
  try {
    notification = await EmailNotification.create({
      company_id: context.companyId,
      application_id: context.applicationId,
      candidate_id: context.candidateId,
      application_assessment_id: assessment.id,
      category: "assessment_invitation",
      recipient_email: context.candidateEmail,
      subject: content.subject,
      assessment_snapshot: snapshot,
      status: "pending",
      triggered_by_user_id: userId,
      // Not used for THIS category's own concurrency (the partial
      // pending-index above handles that) — but every row still needs a
      // genuinely distinct value here so it can never collide with an
      // unrelated assessment's row on the EXISTING interview_id/category/
      // mutation_version_at unique index (interview_id defaults to null
      // for every non-interview row; see that index's own doc comment on
      // EmailNotification.model.ts for why leaving this null too would
      // make two different assessments' invitations collide with each
      // other on that index).
      mutation_version_at: new Date(),
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Another send for this exact assessment is still in flight (the
      // classic rapid-double-click race) — see the partial unique index's
      // own doc comment. A safe conflict, never a second email.
      throw new ConflictError(SEND_IN_PROGRESS_MESSAGE);
    }
    throw err;
  }

  assessment.sent_at = new Date();
  await assessment.save();

  await attemptEmailDelivery(notification, content);
  return notification;
}

/**
 * Explicit "Retry Email" for a FAILED assessment invitation — retries the
 * SAME row in place (never creates a new one), rendering from that row's
 * own immutable assessment_snapshot, never from a fresh
 * Application/Candidate/Job/Company lookup and never from the
 * assessment's CURRENT name/external_url (which may have been edited
 * since this notification's original event — see this ticket's explicit
 * Part 12/32). Company-scoped by the notification's own company_id, and
 * additionally verified to belong to the given assessmentId so a
 * notification id from a DIFFERENT assessment can never be retried
 * through this one's route.
 */
export async function retryAssessmentNotification(
  companyId: string,
  assessmentId: string,
  notificationId: string
): Promise<EmailNotificationDoc> {
  const assessment = await ApplicationAssessment.findOne({
    ...applicationAssessmentIdentifierFilter(assessmentId),
    company_id: companyId,
  });
  if (!assessment) {
    throw new NotFoundError("Assessment not found");
  }

  const notification = await EmailNotification.findOne({
    ...emailNotificationIdentifierFilter(notificationId),
    company_id: companyId,
    application_assessment_id: assessment.id,
    category: "assessment_invitation",
  });
  if (!notification) {
    throw new NotFoundError("Notification not found");
  }
  if (notification.status !== "failed") {
    throw new ConflictError(NOT_RETRYABLE_MESSAGE);
  }

  // assessment_snapshot is guaranteed set for every assessment_invitation
  // row (sendAssessmentInvitation always provides it) — only optional at
  // the schema level to also accommodate interview_* rows.
  const content = buildContentFromSnapshot(notification.assessment_snapshot!);
  await attemptEmailDelivery(notification, content);
  return notification;
}

/**
 * Full notification history for one assessment, newest first — same
 * tenant scoping as interviewNotification.service.ts's
 * listNotificationsForInterview.
 */
export async function listNotificationsForAssessment(companyId: string, assessmentId: string): Promise<EmailNotificationDoc[]> {
  const assessment = await ApplicationAssessment.findOne({
    ...applicationAssessmentIdentifierFilter(assessmentId),
    company_id: companyId,
  });
  if (!assessment) {
    throw new NotFoundError("Assessment not found");
  }
  return EmailNotification.find({ application_assessment_id: assessment.id }).sort({ created_at: -1 });
}

export interface LatestAssessmentNotificationSummary {
  status: EmailNotificationStatus;
}

/**
 * Batches "the most recent assessment_invitation notification's status"
 * across a whole list of assessments into ONE aggregation query — never
 * one lookup per assessment. Mirrors
 * interviewNotification.service.ts's batchLatestNotificationStatus
 * exactly, for the assessment_invitation category instead.
 */
export async function batchLatestAssessmentEmailStatus(
  applicationAssessmentIds: string[]
): Promise<Map<string, EmailNotificationStatus>> {
  if (applicationAssessmentIds.length === 0) {
    return new Map();
  }

  const results = await EmailNotification.aggregate<{ _id: Types.ObjectId; status: EmailNotificationStatus }>([
    { $match: { application_assessment_id: { $in: applicationAssessmentIds.map((id) => new Types.ObjectId(id)) } } },
    { $sort: { created_at: -1 } },
    { $group: { _id: "$application_assessment_id", status: { $first: "$status" } } },
  ]);

  return new Map(results.map((result) => [result._id.toString(), result.status]));
}
