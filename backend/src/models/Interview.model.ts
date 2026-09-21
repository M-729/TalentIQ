import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { HIRING_STEP_TYPES } from "./HiringStep.model";

export const INTERVIEW_STATUSES = ["scheduled", "cancelled", "completed"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

/**
 * Explicit, typed snapshot of the HiringStep the Interview was scheduled
 * against, AT THE MOMENT of scheduling — never a generic Mixed blob, and
 * never dynamically re-resolved from the live HiringStep collection when
 * reading an Interview later. A HiringStep may be renamed (e.g.
 * "Technical Interview" -> "Engineering Interview") or, once no longer
 * referenced, deleted outright — this snapshot is what lets a historical
 * Interview still accurately say what stage it was scheduled under,
 * matching the exact pattern ApplicationStageTransition.model.ts already
 * established for the same reason. Reuses HIRING_STEP_TYPES (not a
 * narrower "interview"-only literal) for consistency with that same
 * precedent, even though in practice this ticket's business rule means
 * it is always "interview" here.
 */
const interviewStageSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: HIRING_STEP_TYPES, required: true },
  },
  { _id: false }
);

/**
 * Core scheduling record for an interview-type HiringStep. Interviews are
 * always an explicit HR/Admin action (see interview.service.ts) — moving
 * an Application into an interview stage never creates one automatically,
 * and nothing here calls AI, Google, or email (that integration is a
 * later ticket).
 *
 * `job_id` is denormalized from the Application at scheduling time (same
 * rationale as ApplicationStageTransition.model.ts's own job_id) — it
 * lets tenant resolution and historical queries avoid an extra
 * Application lookup, and stays valid even after the Job is later
 * soft-deleted. Interviews are never hard-deleted in normal product flow
 * — cancellation sets status/cancelled_* fields, it never removes the
 * document, since Interview history is business/audit data.
 */
const interviewSchema = new Schema(
  {
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    hiring_step_id: { type: Schema.Types.ObjectId, ref: "HiringStep", required: true },

    stage_snapshot: { type: interviewStageSnapshotSchema, required: true },

    title: { type: String, required: true, trim: true, maxlength: 150 },

    starts_at: { type: Date, required: true },
    ends_at: { type: Date, required: true },
    // IANA identifier only (e.g. "Asia/Beirut") — starts_at/ends_at are
    // always stored as UTC instants; this is purely for correct
    // localized display/calendar rendering downstream, never used to
    // reinterpret the stored instants.
    timezone: { type: String, required: true, trim: true },

    interviewer_user_ids: {
      type: [{ type: Schema.Types.ObjectId, ref: "User" }],
      required: true,
      validate: {
        validator: (ids: unknown[]) => ids.length > 0,
        message: "At least one interviewer is required",
      },
    },

    status: { type: String, enum: INTERVIEW_STATUSES, default: "scheduled", required: true },

    // Always the authenticated scheduler's userId — never accepted from
    // the request body (see interview.validation.ts's .strict() schemas).
    // Deliberately NOT necessarily one of interviewer_user_ids — no
    // product reason exists yet to auto-add the scheduler as a
    // participant.
    scheduled_by: { type: Schema.Types.ObjectId, ref: "User", required: true },

    cancelled_by: { type: Schema.Types.ObjectId, ref: "User", default: null },
    cancelled_at: { type: Date, default: null },
    cancellation_reason: { type: String, trim: true, maxlength: 1000, default: null },

    // Reserved for the next ticket's Google Calendar/Meet integration —
    // deliberately added now (per this ticket's explicit invitation) so
    // that ticket doesn't need an awkward schema migration, but never
    // populated, never client-controlled, and never a secret/token: just
    // a provider name, an opaque event id, and a meeting URL. All
    // nullable so every Interview this ticket creates is valid without
    // them.
    calendar_provider: { type: String, trim: true, default: null },
    calendar_event_id: { type: String, trim: true, default: null },
    meeting_url: { type: String, trim: true, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Serves both "this Application's interviews" and "...ordered starts_at
// DESC" (the list endpoint's exact query) directly from the index, with
// no in-memory sort — see interview.service.ts's listInterviewsForApplication.
interviewSchema.index({ application_id: 1, starts_at: -1 });

/**
 * Prevents a duplicate ACTIVE (status: "scheduled") Interview for the
 * same Application + HiringStep at the database level — not just a
 * service-layer pre-check — so two concurrent "Schedule Interview"
 * requests can never both succeed (see interview.service.ts's
 * scheduleInterview, which pre-checks for a fast/friendly reject in the
 * common case and also catches this index's duplicate-key error as the
 * race-safety net). A partial index (not a plain compound unique index)
 * is essential here: once an Interview is cancelled or completed, a
 * later Interview legitimately may be scheduled for the same
 * Application+HiringStep, and a non-partial unique index would wrongly
 * block that.
 */
interviewSchema.index(
  { application_id: 1, hiring_step_id: 1 },
  { unique: true, partialFilterExpression: { status: "scheduled" } }
);

export type InterviewDoc = HydratedDocument<InferSchemaType<typeof interviewSchema>>;

export const Interview = model("Interview", interviewSchema);
