import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Deliberately generic ("EmailNotification", not "InterviewEmail") so the
// future /emails page can list/filter across every candidate-facing email
// category TalentIQ ever sends, not just interview ones — see this
// ticket's explicit "prepare the design so the future Emails page can
// reuse the records" requirement. Only interview categories exist today;
// a later ticket (e.g. application-confirmation delivery tracking) can
// add its own category value here without a schema change.
export const EMAIL_NOTIFICATION_CATEGORIES = ["interview_scheduled", "interview_rescheduled", "interview_cancelled"] as const;
export type EmailNotificationCategory = (typeof EMAIL_NOTIFICATION_CATEGORIES)[number];

export const EMAIL_NOTIFICATION_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailNotificationStatus = (typeof EMAIL_NOTIFICATION_STATUSES)[number];

// A safe, provider-neutral taxonomy — never a raw Nodemailer/SMTP error
// message or stack (see services/email/emailFailureTaxonomy.ts's
// mapSmtpError, the only place a real SMTP error's shape is inspected).
// Declared here, not in services/email/, matching Interview.model.ts's own
// CALENDAR_SYNC_ERROR_CODES precedent: the model is the single source of
// truth for what can legally be stored in failure_code below.
export const EMAIL_FAILURE_CODES = [
  "smtp_not_configured",
  "smtp_unavailable",
  "authentication_failed",
  "recipient_rejected",
  "delivery_failed",
] as const;
export type EmailFailureCode = (typeof EMAIL_FAILURE_CODES)[number];

/**
 * The immutable content this ONE email event actually said — captured
 * from the Interview/Application/Candidate/Job/Company records AT THE
 * MOMENT the triggering mutation (schedule/reschedule/cancel) committed,
 * and never re-derived from live data again afterward. This is what
 * makes a retry historically faithful: if the Interview is rescheduled
 * again (or its interviewers change, or a Meet link is added) AFTER this
 * event, retrying THIS notification must still describe what was true
 * when IT happened, not what's true now — seehe production incident this
 * fixes, documented in interviewNotification.service.ts.
 *
 * Never the full rendered HTML/text body — just the small set of
 * immutable facts needed to deterministically re-render the same email
 * again later (the templates themselves stay the single source of truth
 * for wording/layout, so a future template wording tweak still applies
 * retroactively to a retried historical email, which is desirable; only
 * the underlying DATA is frozen, not the presentation). See
 * interviewNotification.service.ts's own doc comment for the production
 * incident this fixes.
 */
const eventSnapshotSchema = new Schema(
  {
    candidate_name: { type: String, required: true, trim: true },
    company_name: { type: String, required: true, trim: true },
    job_title: { type: String, required: true, trim: true },
    interview_title: { type: String, required: true, trim: true },
    // Not required — the cancellation email doesn't display it, and a
    // future non-interview category may have no stage at all. Every
    // interview category that DOES use it always sets it.
    stage_name: { type: String, trim: true, default: null },
    starts_at: { type: Date, required: true },
    ends_at: { type: Date, required: true },
    timezone: { type: String, required: true, trim: true },
    interviewer_names: { type: [String], default: [] },
    // Whether a REAL Google Meet link existed AT THIS EXACT EVENT — never
    // re-checked against the Interview's current meeting_url on retry (a
    // Meet link added after this event must never "magically" appear in
    // a retry of an earlier notification whose snapshot had none).
    meeting_url: { type: String, trim: true, default: null },
  },
  { _id: false }
);

/**
 * Real notification history/audit — deliberately NOT a boolean
 * `email_sent` flag on Interview. One document per real business email
 * *event* (an Interview being scheduled, a specific reschedule, a
 * cancellation), retried IN PLACE (attempt_count/attempted_at/status
 * updated on the same document) rather than creating a new row per retry
 * — see modules/interviews/interviewNotification.service.ts.
 *
 * Stores only what's needed to safely re-render and audit a notification
 * later: template category + subject + the immutable event_snapshot,
 * never the full rendered HTML/text body, and never SMTP credentials or
 * raw provider errors.
 */
const emailNotificationSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    candidate_id: { type: Schema.Types.ObjectId, ref: "Candidate", required: true },
    // Nullable for a future non-interview category (e.g. application
    // confirmation) — every category that exists today always sets it.
    interview_id: { type: Schema.Types.ObjectId, ref: "Interview", default: null },

    category: { type: String, enum: EMAIL_NOTIFICATION_CATEGORIES, required: true },

    // A snapshot of the candidate's email AT SEND TIME — retry reuses
    // this exact value (never a fresh candidate lookup, and never a
    // client-supplied recipient) so a retry always targets the same
    // recipient the original attempt did.
    recipient_email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },

    // The frozen content facts for this exact event — see
    // eventSnapshotSchema's own doc comment. A retry always renders from
    // THIS, never from a fresh Interview lookup.
    event_snapshot: { type: eventSnapshotSchema, required: true },

    status: { type: String, enum: EMAIL_NOTIFICATION_STATUSES, required: true, default: "pending" },
    failure_code: { type: String, enum: [...EMAIL_FAILURE_CODES, null], default: null },

    attempted_at: { type: Date, default: null },
    sent_at: { type: Date, default: null },
    // Counts every send attempt, including the first — incremented again
    // on each retry (see interviewNotification.service.ts's retry flow).
    attempt_count: { type: Number, required: true, default: 0 },

    // The HR/Admin user whose action (schedule/reschedule/cancel) caused
    // this notification to be created — null would only occur for a
    // future system-triggered (non-user-initiated) category.
    triggered_by_user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // The persisted Interview.updated_at value AT THE MOMENT this
    // notification's underlying mutation was committed — see this
    // ticket's Part 9. This is what makes duplicate-event detection
    // deterministic: a genuine second reschedule always produces a new
    // Interview.updated_at (and therefore a new row here), while two
    // accidental/duplicate calls for the SAME already-committed mutation
    // share the same value and collide on the unique index below rather
    // than creating a second notification.
    mutation_version_at: { type: Date, required: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// One notification per (interview, category, mutation) — see
// mutation_version_at's own doc comment above for exactly what this
// prevents and what it deliberately still allows (a second, later,
// genuinely distinct reschedule).
emailNotificationSchema.index({ interview_id: 1, category: 1, mutation_version_at: 1 }, { unique: true });

// Serves "this Interview's full notification history, newest first" (the
// GET .../notifications endpoint) directly from the index.
emailNotificationSchema.index({ interview_id: 1, created_at: -1 });

export type EmailNotificationDoc = HydratedDocument<InferSchemaType<typeof emailNotificationSchema>>;

// The plain (non-Mongoose-subdocument) shape callers build to persist a
// new event_snapshot — InferSchemaType already gives us this exact shape
// via the parent document's own type, re-exported standalone so
// interviewNotification.service.ts doesn't need to reach back into
// Mongoose's subdocument typing.
export type EventSnapshot = InferSchemaType<typeof eventSnapshotSchema>;

export const EmailNotification = model("EmailNotification", emailNotificationSchema);
