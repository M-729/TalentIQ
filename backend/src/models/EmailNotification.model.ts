import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Deliberately generic ("EmailNotification", not "InterviewEmail") so the
// future /emails page can list/filter across every candidate-facing email
// category TalentIQ ever sends, not just interview ones — see this
// ticket's explicit "prepare the design so the future Emails page can
// reuse the records" requirement. A later ticket (e.g. application-
// confirmation delivery tracking) can add its own category value here
// without a schema change. "assessment_invitation" (added for the
// External Assessment ticket) is the first non-interview category,
// proving out that extensibility — see application_assessment_id/
// assessment_snapshot below for its category-specific fields, following
// the exact same "denormalized id + immutable snapshot" shape
// interview_id/event_snapshot already established.
export const EMAIL_NOTIFICATION_CATEGORIES = [
  "interview_scheduled",
  "interview_rescheduled",
  "interview_cancelled",
  "assessment_invitation",
] as const;
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
 * The assessment_invitation category's own immutable snapshot — same
 * "freeze the facts this ONE event actually said" contract as
 * eventSnapshotSchema above, kept as its own separate shape rather than
 * shoehorned into the interview-shaped one (an assessment has no
 * starts_at/ends_at/interviewers, and an interview snapshot has no
 * external_url). See this ticket's explicit Part 12: if HR edits the
 * external_url AFTER a send failed, retrying that historical notification
 * must still use the ORIGINAL link, never the corrected one — a corrected
 * link only ever goes out via a brand-new, explicit "Send Again" event
 * (which freezes its own fresh snapshot at that later moment).
 */
const assessmentSnapshotSchema = new Schema(
  {
    candidate_name: { type: String, required: true, trim: true },
    company_name: { type: String, required: true, trim: true },
    job_title: { type: String, required: true, trim: true },
    assessment_name: { type: String, required: true, trim: true },
    external_url: { type: String, required: true, trim: true },
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
    // Nullable — set for every interview_* category, left unset (absent)
    // for assessment_invitation. Deliberately no `default: null` (unlike
    // application_assessment_id below being the mirror case for interview
    // rows) is not required here since existing interview-creation code
    // already always supplies a real value.
    interview_id: { type: Schema.Types.ObjectId, ref: "Interview", default: null },
    // The assessment_invitation category's own business-entity id — same
    // role as interview_id above, for the assessment_invitation category.
    // Deliberately NO default: left genuinely absent (not stored as
    // explicit null) for every interview_* row, which is what lets the
    // partial unique index below apply ONLY to assessment notifications —
    // see that index's own doc comment.
    application_assessment_id: { type: Schema.Types.ObjectId, ref: "ApplicationAssessment" },

    category: { type: String, enum: EMAIL_NOTIFICATION_CATEGORIES, required: true },

    // A snapshot of the candidate's email AT SEND TIME — retry reuses
    // this exact value (never a fresh candidate lookup, and never a
    // client-supplied recipient) so a retry always targets the same
    // recipient the original attempt did.
    recipient_email: { type: String, required: true, trim: true, lowercase: true },
    subject: { type: String, required: true, trim: true },

    // The frozen content facts for this exact event — see
    // eventSnapshotSchema's own doc comment. A retry always renders from
    // THIS, never from a fresh Interview lookup. Not required at the
    // schema level (only every interview_* category sets it; see
    // assessment_snapshot below for the assessment_invitation
    // counterpart) — required-ness per category is enforced in the
    // service layer that builds each category's row, not here.
    event_snapshot: { type: eventSnapshotSchema, default: null },
    // The assessment_invitation category's own immutable snapshot — see
    // assessmentSnapshotSchema's own doc comment. Mirrors event_snapshot's
    // role exactly, for the other category family.
    assessment_snapshot: { type: assessmentSnapshotSchema, default: null },

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
    // than creating a second notification. Only interview_* categories use
    // this field at all — assessment_invitation uses a different
    // concurrency mechanism (see the partial index below), since a
    // "Send Assessment"/"Send Again" click isn't a side effect of some
    // other mutation with its own natural version stamp the way
    // schedule/reschedule/cancel are.
    mutation_version_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// One notification per (interview, category, mutation) — see
// mutation_version_at's own doc comment above for exactly what this
// prevents and what it deliberately still allows (a second, later,
// genuinely distinct reschedule). Deliberately UNCHANGED from before the
// assessment_invitation category existed — every assessment_invitation
// row still sets its own real, distinct mutation_version_at value (see
// applicationAssessmentEmail.service.ts) specifically so it can never
// collide with another assessment row here, without needing to alter this
// index's options (MongoDB rejects/conflicts on redefining an existing
// index's options without a drop, which is riskier than just giving every
// row a genuinely unique value for this field).
emailNotificationSchema.index({ interview_id: 1, category: 1, mutation_version_at: 1 }, { unique: true });

// Serves "this Interview's full notification history, newest first" (the
// GET .../notifications endpoint) directly from the index.
emailNotificationSchema.index({ interview_id: 1, created_at: -1 });

/**
 * The assessment_invitation double-send/double-click guard — deliberately
 * a DIFFERENT mechanism from mutation_version_at above (see that field's
 * own doc comment for why). At most one row may be "pending" at a time for
 * a given assessment: the moment a send request creates its row with
 * status "pending", a concurrent second request's own create() collides
 * on this index and is safely treated as "already in flight" (see
 * applicationAssessmentEmail.service.ts's isDuplicateKeyError handling —
 * the exact same pattern createAndSendNotification already uses). Once
 * delivery resolves (status becomes "sent" or "failed"), the row no longer
 * matches the partial filter, so a LATER, genuinely separate "Send Again"
 * or "Retry Email" click is never blocked by an earlier, already-resolved
 * attempt. `$exists: true` scopes this to assessment rows only — every
 * interview_* row has application_assessment_id genuinely absent (no
 * `default`, see the field above), so this index can never interact with
 * interview notifications at all.
 */
emailNotificationSchema.index(
  { application_assessment_id: 1, category: 1 },
  { unique: true, partialFilterExpression: { application_assessment_id: { $exists: true }, status: "pending" } }
);

// Serves "this assessment's full notification history, newest first".
emailNotificationSchema.index({ application_assessment_id: 1, created_at: -1 });

export type EmailNotificationDoc = HydratedDocument<InferSchemaType<typeof emailNotificationSchema>>;

// The plain (non-Mongoose-subdocument) shape callers build to persist a
// new event_snapshot — InferSchemaType already gives us this exact shape
// via the parent document's own type, re-exported standalone so
// interviewNotification.service.ts doesn't need to reach back into
// Mongoose's subdocument typing.
export type EventSnapshot = InferSchemaType<typeof eventSnapshotSchema>;

// Same rationale as EventSnapshot above, for the assessment_invitation category.
export type AssessmentSnapshot = InferSchemaType<typeof assessmentSnapshotSchema>;

export const EmailNotification = model("EmailNotification", emailNotificationSchema);
