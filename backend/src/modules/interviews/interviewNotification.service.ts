import { Types } from "mongoose";
import {
  EmailNotification,
  type EmailNotificationCategory,
  type EmailNotificationDoc,
  type EmailNotificationStatus,
  type EventSnapshot,
} from "../../models/EmailNotification.model";
import type { InterviewDoc } from "../../models/Interview.model";
import { Application } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { User } from "../../models/User.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { emailService } from "../../services/email/email.service";
import type { EmailContent } from "../../services/email/email.types";
import { mapSmtpError } from "../../services/email/emailFailureTaxonomy";
import { formatZonedDate, formatZonedTimeRange } from "../../utils/timezone";
import { buildInterviewScheduledEmail } from "../../services/email/templates/interviewScheduled.template";
import { buildInterviewRescheduledEmail } from "../../services/email/templates/interviewRescheduled.template";
import { buildInterviewCancelledEmail } from "../../services/email/templates/interviewCancelled.template";
import { getAccessibleInterview } from "./interviewAccess.service";

const NOT_RETRYABLE_MESSAGE = "Only failed notifications can be retried.";

interface NotificationContext {
  companyId: string;
  applicationId: string;
  candidateId: string;
  candidateName: string;
  candidateEmail: string;
  jobTitle: string;
  companyName: string;
  interviewerNames: string[];
}

/**
 * Resolves everything needed to construct a NEW event snapshot at the
 * moment a mutation (schedule/reschedule/cancel) commits — live data, on
 * purpose, since this only ever runs once per real event, right when
 * that event is happening. Returns null (never throws) if any required
 * piece is missing — this can only happen for genuinely corrupt data (an
 * Interview whose Application was hard-deleted, which the product never
 * does), and the caller treats it as "cannot notify right now" rather
 * than crashing the calling mutation.
 */
async function resolveNotificationContext(interview: InterviewDoc): Promise<NotificationContext | null> {
  const application = await Application.findById(interview.application_id).select("candidate_id");
  if (!application) return null;

  const candidate = await Candidate.findById(application.candidate_id).select("full_name email");
  if (!candidate) return null;

  const job = await Job.findById(interview.job_id).select("title company_id");
  if (!job) return null;

  const company = await Company.findById(job.company_id).select("name");
  const interviewers = await User.find({ _id: { $in: interview.interviewer_user_ids } }).select("name");

  return {
    companyId: job.company_id.toString(),
    applicationId: application.id,
    candidateId: candidate.id,
    candidateName: candidate.full_name,
    candidateEmail: candidate.email,
    jobTitle: job.title,
    companyName: company?.name ?? "the hiring company",
    interviewerNames: interviewers.map((interviewer) => interviewer.name),
  };
}

/**
 * Freezes the facts this ONE email event actually says, at the exact
 * moment it happens — see EmailNotification.model.ts's eventSnapshotSchema
 * doc comment for why this must never be re-derived from live data again.
 * `meeting_url` reflects whatever the Interview's meeting_url is RIGHT
 * NOW (real backend data only, never fabricated — see this ticket's Part
 * 2/12) — which may legitimately be null if no Google Calendar event
 * exists yet.
 */
function buildEventSnapshot(interview: InterviewDoc, ctx: NotificationContext): EventSnapshot {
  return {
    candidate_name: ctx.candidateName,
    company_name: ctx.companyName,
    job_title: ctx.jobTitle,
    interview_title: interview.title,
    stage_name: interview.stage_snapshot.name,
    starts_at: interview.starts_at,
    ends_at: interview.ends_at,
    timezone: interview.timezone,
    interviewer_names: ctx.interviewerNames,
    meeting_url: interview.meeting_url ?? null,
  };
}

function buildScheduledContent(snapshot: EventSnapshot): EmailContent {
  return buildInterviewScheduledEmail({
    candidateName: snapshot.candidate_name,
    companyName: snapshot.company_name,
    jobTitle: snapshot.job_title,
    interviewTitle: snapshot.interview_title,
    stageName: snapshot.stage_name ?? "",
    dateLabel: formatZonedDate(snapshot.starts_at, snapshot.timezone),
    timeRangeLabel: formatZonedTimeRange(snapshot.starts_at, snapshot.ends_at, snapshot.timezone),
    timezone: snapshot.timezone,
    interviewerNames: snapshot.interviewer_names,
    meetingUrl: snapshot.meeting_url ?? null,
  });
}

function buildRescheduledContent(snapshot: EventSnapshot): EmailContent {
  return buildInterviewRescheduledEmail({
    candidateName: snapshot.candidate_name,
    companyName: snapshot.company_name,
    jobTitle: snapshot.job_title,
    interviewTitle: snapshot.interview_title,
    stageName: snapshot.stage_name ?? "",
    dateLabel: formatZonedDate(snapshot.starts_at, snapshot.timezone),
    timeRangeLabel: formatZonedTimeRange(snapshot.starts_at, snapshot.ends_at, snapshot.timezone),
    timezone: snapshot.timezone,
    interviewerNames: snapshot.interviewer_names,
    meetingUrl: snapshot.meeting_url ?? null,
  });
}

function buildCancelledContent(snapshot: EventSnapshot): EmailContent {
  return buildInterviewCancelledEmail({
    candidateName: snapshot.candidate_name,
    companyName: snapshot.company_name,
    jobTitle: snapshot.job_title,
    interviewTitle: snapshot.interview_title,
    dateLabel: formatZonedDate(snapshot.starts_at, snapshot.timezone),
    timeRangeLabel: formatZonedTimeRange(snapshot.starts_at, snapshot.ends_at, snapshot.timezone),
    timezone: snapshot.timezone,
    // Deliberately NEVER a cancellation reason — see this ticket's
    // explicit privacy rule and interviewCancelled.template.ts's own doc
    // comment. The snapshot itself never carries one either.
  });
}

/**
 * The ONLY place category dispatches to a template builder — used
 * identically by the initial send and by retry, always from a snapshot,
 * never from a live Interview lookup. This is what guarantees a retry is
 * historically faithful: rendering is a pure function of already-frozen
 * data, so it produces the exact same content every time it's called for
 * a given notification, regardless of what has happened to the Interview
 * since.
 */
function buildContentForCategory(category: EmailNotificationCategory, snapshot: EventSnapshot): EmailContent {
  switch (category) {
    case "interview_scheduled":
      return buildScheduledContent(snapshot);
    case "interview_rescheduled":
      return buildRescheduledContent(snapshot);
    case "interview_cancelled":
      return buildCancelledContent(snapshot);
  }
}

/** Only the safe, already-normalized failure code is ever logged — never the raw SMTP error (see emailFailureTaxonomy.ts's mapSmtpError doc comment). */
function logSafeDeliveryFailure(notification: EmailNotificationDoc): void {
  console.error("[interviewNotification] delivery failed", {
    notificationId: notification.id,
    interviewId: notification.interview_id?.toString(),
    category: notification.category,
    failureCode: notification.failure_code,
  });
}

/**
 * Attempts delivery for an already-persisted (pending or previously-
 * failed) notification and updates its status in place — used by both
 * the initial send and retry. Never throws: SMTP failure is recorded on
 * the document, not propagated, so a caller further up (an Interview
 * mutation handler, or the retry endpoint) never fails because of it.
 */
async function attemptDelivery(notification: EmailNotificationDoc, content: EmailContent): Promise<void> {
  notification.attempted_at = new Date();
  notification.attempt_count += 1;
  // Deterministic given the (frozen) snapshot — re-setting this on every
  // attempt is a no-op in practice, not a source of drift.
  notification.subject = content.subject;

  try {
    await emailService.send({ to: notification.recipient_email, subject: content.subject, text: content.text, html: content.html });
    notification.status = "sent";
    notification.sent_at = new Date();
    notification.failure_code = null;
  } catch (err) {
    notification.status = "failed";
    notification.failure_code = mapSmtpError(err);
    logSafeDeliveryFailure(notification);
  }

  await notification.save();
}

interface CreateAndSendParams {
  category: EmailNotificationCategory;
  interview: InterviewDoc;
  triggeredByUserId: string;
}

/**
 * Creates the notification record for one real business email event —
 * freezing an event_snapshot from current data (this runs exactly once,
 * right as the event happens) — and attempts delivery. Idempotent per
 * (interview, category, interview.updated_at-at-mutation-time) — see
 * EmailNotification.model.ts's mutation_version_at doc comment: a
 * duplicate call for the SAME already-committed mutation collides on the
 * unique index and is treated as already-handled (not an error), while a
 * genuinely later mutation (a new updated_at) always creates its own new
 * notification with its own new snapshot.
 *
 * IMPORTANT — the exact scope of what this protects, stated precisely so
 * it is never overclaimed:
 *
 *   PROTECTED (A): this function itself being called twice for the SAME
 *   already-committed Interview document (i.e. the exact same
 *   `interview.updated_at`) — e.g. a bug that called it twice in one
 *   request, or a retry at THIS layer. The second call's insert collides
 *   on the unique index and is a safe no-op.
 *
 *   NOT PROTECTED (B): a client/network-level duplicate HTTP request that
 *   causes interviewService.rescheduleInterview() ITSELF to run a second
 *   time (e.g. a browser or proxy resending a PATCH /reschedule after a
 *   slow/lost response, even though the first request already
 *   committed). rescheduleInterview()'s own guard is only
 *   `{ status: "scheduled" }` — reschedule does not change status, so a
 *   second identical request still matches that guard and succeeds
 *   again, producing a genuinely NEW `updated_at` and therefore a
 *   genuinely new (and, from the candidate's perspective, duplicate)
 *   rescheduled-notification email. This is a property of the
 *   RESCHEDULE mutation itself having no request-level idempotency key,
 *   not something the EmailNotification layer can or should paper over.
 *   scheduleInterview() and cancelInterview() are NOT exposed to this gap
 *   — scheduleInterview() is protected by Interview.model.ts's own
 *   partial-unique index (a second concurrent/duplicate create for the
 *   same Application+HiringStep is rejected before any notification code
 *   ever runs), and cancelInterview()'s guard is a genuine one-way gate
 *   (`{status: "scheduled"}` -> "cancelled"), so a second cancel request
 *   finds nothing left to match and never reaches the notification call
 *   at all. Closing gap B for reschedule specifically would need a
 *   client-supplied idempotency key or a short request-level debounce —
 *   deliberately out of scope for this ticket.
 */
async function createAndSendNotification(params: CreateAndSendParams): Promise<void> {
  const context = await resolveNotificationContext(params.interview);
  if (!context) {
    console.error("[interviewNotification] could not resolve candidate/job context, skipping", {
      interviewId: params.interview.id,
      category: params.category,
    });
    return;
  }

  const snapshot = buildEventSnapshot(params.interview, context);
  const content = buildContentForCategory(params.category, snapshot);

  let notification: EmailNotificationDoc;
  try {
    notification = await EmailNotification.create({
      company_id: context.companyId,
      application_id: context.applicationId,
      candidate_id: context.candidateId,
      interview_id: params.interview.id,
      category: params.category,
      recipient_email: context.candidateEmail,
      subject: content.subject,
      event_snapshot: snapshot,
      status: "pending",
      triggered_by_user_id: params.triggeredByUserId,
      mutation_version_at: params.interview.updated_at,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // Already created for this exact interview + category + mutation —
      // a duplicate handler execution for an already-committed change,
      // not a new event. Silently no-ops rather than sending a second
      // email for the same mutation.
      return;
    }
    throw err;
  }

  await attemptDelivery(notification, content);
}

/**
 * Never throws — the Interview mutation this follows has ALREADY
 * succeeded and been persisted by the time any of these three functions
 * run; a notification-layer failure (DB write, SMTP, or otherwise) must
 * never surface as if the schedule/reschedule/cancel itself failed. Only
 * safe metadata is logged (see logSafeDeliveryFailure / the catch below).
 */
export async function sendInterviewScheduledNotification(interview: InterviewDoc, triggeredByUserId: string): Promise<void> {
  try {
    await createAndSendNotification({ category: "interview_scheduled", interview, triggeredByUserId });
  } catch (err) {
    console.error("[interviewNotification] failed to create/send scheduled notification", {
      interviewId: interview.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendInterviewRescheduledNotification(interview: InterviewDoc, triggeredByUserId: string): Promise<void> {
  try {
    await createAndSendNotification({ category: "interview_rescheduled", interview, triggeredByUserId });
  } catch (err) {
    console.error("[interviewNotification] failed to create/send rescheduled notification", {
      interviewId: interview.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function sendInterviewCancelledNotification(interview: InterviewDoc, triggeredByUserId: string): Promise<void> {
  try {
    await createAndSendNotification({ category: "interview_cancelled", interview, triggeredByUserId });
  } catch (err) {
    console.error("[interviewNotification] failed to create/send cancelled notification", {
      interviewId: interview.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Full notification history for one Interview, newest first — uses the
 * HISTORICAL access variant (works after Job soft-delete), matching every
 * other read of Interview data that's meant to remain available as
 * business/audit history.
 */
export async function listNotificationsForInterview(interviewId: string, companyId: string): Promise<EmailNotificationDoc[]> {
  await getAccessibleInterview(interviewId, companyId);
  return EmailNotification.find({ interview_id: interviewId }).sort({ created_at: -1 });
}

/**
 * Explicit retry for a FAILED candidate notification — HR/Admin only (see
 * interviewNotificationRetry.routes.ts), company-scoped by the
 * notification's own company_id (denormalized, so no extra Job lookup is
 * needed to establish tenancy).
 *
 * Renders content from the notification's own persisted, IMMUTABLE
 * event_snapshot — never from a fresh Interview/Application/Candidate/
 * Job/Company lookup, and never from request-body content. This is
 * deliberate: an Interview may have been rescheduled again, had its
 * interviewers changed, or gained a Meet link SINCE this notification's
 * original event — retrying it must still describe what was true at the
 * time of THAT event, not the Interview's current state (see this
 * ticket's own historical-retry bug report). Always sends to the
 * notification's own persisted recipient_email snapshot — never a
 * client-supplied address.
 */
export async function retryNotification(notificationId: string, companyId: string): Promise<EmailNotificationDoc> {
  const notification = await EmailNotification.findOne({ _id: notificationId, company_id: companyId });
  if (!notification) {
    throw new NotFoundError("Notification not found");
  }
  if (notification.status !== "failed") {
    throw new ConflictError(NOT_RETRYABLE_MESSAGE);
  }

  const content = buildContentForCategory(notification.category, notification.event_snapshot);
  await attemptDelivery(notification, content);
  return notification;
}

export interface LatestNotificationSummary {
  category: EmailNotificationCategory;
  status: EmailNotificationStatus;
}

/**
 * Batches "the most recent notification's category+status" across a
 * whole list of Interviews into ONE aggregation query — never one lookup
 * per Interview. Mirrors applicationHr.service.ts's
 * getLatestScreeningSummaries exactly. Used to surface a lightweight
 * delivery-state hint on the Interview DTO (list, detail, and every
 * mutation response) without ever risking an N+1 request pattern on the
 * /interviews list or Application detail's Interviews section.
 */
export async function batchLatestNotificationStatus(interviewIds: string[]): Promise<Map<string, LatestNotificationSummary>> {
  if (interviewIds.length === 0) {
    return new Map();
  }

  const results = await EmailNotification.aggregate<{ _id: Types.ObjectId; category: EmailNotificationCategory; status: EmailNotificationStatus }>([
    { $match: { interview_id: { $in: interviewIds.map((id) => new Types.ObjectId(id)) } } },
    { $sort: { created_at: -1 } },
    { $group: { _id: "$interview_id", category: { $first: "$category" }, status: { $first: "$status" } } },
  ]);

  return new Map(results.map((result) => [result._id.toString(), { category: result.category, status: result.status }]));
}
