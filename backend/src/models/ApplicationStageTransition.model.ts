import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { APPLICATION_STATUSES } from "./Application.model";
import { HIRING_STEP_TYPES } from "./HiringStep.model";

/**
 * An explicit, typed snapshot of a HiringStep's name/type AT THE MOMENT a
 * transition happened — never a generic Mixed blob (a real ATS needs its
 * audit trail to stay meaningful, not an opaque bag of whatever shape
 * happened to be passed in). A HiringStep may later be renamed, or deleted
 * outright once unused (see HiringStep.model.ts / hiringStep.service.ts's
 * deletion-in-use rule) — this snapshot is what lets a historical
 * transition still say "Technical Interview" after the live stage becomes
 * "Engineering Interview" or is removed entirely. Never dynamically
 * re-resolved from the live HiringStep collection when reading history.
 */
const stepSnapshotSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: HIRING_STEP_TYPES, required: true },
  },
  { _id: false }
);

/**
 * Append-only business event: one document per Application stage
 * movement, never mutated after creation. Moving an Application is always
 * an explicit HR/Admin action (see stageTransition.service.ts) — this
 * model has no concept of AI-driven movement and nothing in this codebase
 * may write to it outside that service.
 *
 * Deliberately NOT a single mutable "history" document/array on
 * Application — a real audit trail must let every past movement stay
 * exactly as it was recorded, including if the Application later moves
 * again, its HiringStep is renamed, or the Job is soft-deleted.
 */
const applicationStageTransitionSchema = new Schema(
  {
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    // Denormalized from the Application at transition time — lets history
    // queries and the deletion-in-use rule reason about "this Job's
    // transitions" without an extra Application lookup, and stays valid
    // even after the Job is later soft-deleted.
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },

    // null only for the very first assignment (Application.current_step_id
    // was null beforehand) — see stageTransition.service.ts. Never null
    // for any subsequent movement.
    from_step_id: { type: Schema.Types.ObjectId, ref: "HiringStep", default: null },
    to_step_id: { type: Schema.Types.ObjectId, ref: "HiringStep", required: true },

    from_step_snapshot: { type: stepSnapshotSchema, default: null },
    to_step_snapshot: { type: stepSnapshotSchema, required: true },

    from_status: { type: String, enum: APPLICATION_STATUSES, required: true },
    to_status: { type: String, enum: APPLICATION_STATUSES, required: true },

    // Always the authenticated caller's userId — never accepted from the
    // request body (see stageTransition.validation.ts's .strict() schema).
    moved_by: { type: Schema.Types.ObjectId, ref: "User", required: true },

    note: { type: String, trim: true, maxlength: 1000 },
  },
  {
    // Immutable business events: no updated_at, since nothing ever updates
    // one after creation (no PATCH/DELETE route exists for this model —
    // see stageTransition.routes.ts).
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// The exact query GET .../stage-history always runs: "this Application's
// transitions, newest first". _id is not part of the index itself, but
// the service sorts { created_at: -1, _id: -1 } for a deterministic
// tie-break when two transitions share a created_at millisecond — Mongo
// can still use this index's leading fields for that sort.
applicationStageTransitionSchema.index({ application_id: 1, created_at: -1 });

export type ApplicationStageTransitionDoc = HydratedDocument<InferSchemaType<typeof applicationStageTransitionSchema>>;

export const ApplicationStageTransition = model("ApplicationStageTransition", applicationStageTransitionSchema);
