import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * Tracks the lifecycle of ONE Application's INITIAL AI screening as a
 * single, evolving business process — distinct from AIScreening.model.ts,
 * which is an immutable, append-only SNAPSHOT of a completed run's
 * result. AIScreeningRun is the opposite: a single mutable row per
 * Application that answers "what is the current state of this
 * Application's initial screening attempt right now" (pending/processing/
 * completed/failed), while AIScreening keeps being the append-only history
 * of actual completed results this run eventually points to.
 *
 * Exactly ONE AIScreeningRun document may ever exist per Application (see
 * the unique index below) — this is the concrete, database-level
 * expression of "there is exactly one logical INITIAL screening workflow
 * per Application", not just a frontend/service-layer convention. A
 * completed initial screening's own history (if it is ever regenerated
 * through a future administrative rescreen mechanism, out of scope here)
 * still lives in AIScreening; this row only ever tracks the ONE initial
 * attempt's own state and, once successful, which AIScreening it produced.
 */
export const AI_SCREENING_RUN_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type AIScreeningRunStatus = (typeof AI_SCREENING_RUN_STATUSES)[number];

const aiScreeningRunSchema = new Schema(
  {
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    // Denormalized from the Application at creation time — same rationale
    // as AIScreening.model.ts's own job_id field (avoids an extra lookup
    // for company-scoped/reporting queries; never trusted as an
    // authorization boundary on its own).
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },

    status: { type: String, enum: AI_SCREENING_RUN_STATUSES, default: "pending", required: true },

    // Set only when status becomes "completed" — points at the immutable
    // AIScreening document this run produced. Never duplicates that
    // document's analysis/match data here; readers that need the full
    // result still go through the existing AIScreening read paths.
    screening_id: { type: Schema.Types.ObjectId, ref: "AIScreening", default: null },

    // Safe, internal short codes only — never a raw provider/parser
    // message (see screening.errors.ts's existing taxonomy, which this
    // reuses the `code` values from). failure_message is a short,
    // pre-mapped, HR-safe sentence derived the same way
    // screening.errors.ts already maps errors for HTTP responses — never
    // the original error's own message.
    failure_code: { type: String, trim: true, default: null },
    failure_message: { type: String, trim: true, default: null },

    attempted_at: { type: Date, default: null },
    // Counts every attempt to move this run into "processing", including
    // the automatic first one and every later explicit retry.
    attempt_count: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// The database-level one-run-per-Application invariant — see this
// schema's own doc comment above. A second attempt to create a run row
// for the same Application (a racing automatic trigger, or a legacy
// Application being adopted into this model for the first time via a
// manual "Start Screening" click) collides here and is resolved by
// re-reading the existing row rather than creating a duplicate (see
// screeningRun.service.ts's reserveScreeningRunForProcessing).
aiScreeningRunSchema.index({ application_id: 1 }, { unique: true });

export type AIScreeningRunDoc = HydratedDocument<InferSchemaType<typeof aiScreeningRunSchema>>;

export const AIScreeningRun = model("AIScreeningRun", aiScreeningRunSchema);
