import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// `type` is a behavioral category, never a specific company's stage name —
// "Backend Technical Interview" is a `name` HR chooses; `type: "interview"`
// just tells the system roughly what kind of step it is. Do not add
// specific stage names here.
export const HIRING_STEP_TYPES = ["review", "interview", "assessment", "other"] as const;
export type HiringStepType = (typeof HIRING_STEP_TYPES)[number];

/**
 * A Job's ordered HiringStep documents collectively ARE its hiring
 * pipeline — there is no separate Pipeline model. Positions are
 * maintained as a contiguous 0..N-1 sequence by every mutating operation
 * in hiringStep.service.ts (create appends at count, delete compacts the
 * gap it leaves, reorder reassigns the full contiguous range) — this
 * schema does not enforce that invariant itself beyond `min: 0`.
 *
 * Terminal outcomes (Rejected/Offered/Hired) are deliberately NOT
 * HiringStep records — those are Application.status values. This model
 * only represents active recruitment steps a Job's pipeline actually
 * walks an application through.
 */
const hiringStepSchema = new Schema(
  {
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    type: { type: String, enum: HIRING_STEP_TYPES, required: true },
    description: { type: String, trim: true, maxlength: 1000 },
    // Mongoose's Number type alone doesn't reject non-integers (1.5 would
    // otherwise save silently) — this is what actually enforces "integer".
    position: {
      type: Number,
      required: true,
      min: 0,
      validate: { validator: Number.isInteger, message: "position must be an integer" },
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// The exact query GET /hiring-steps always runs: "this job's stages, in
// pipeline order".
hiringStepSchema.index({ job_id: 1, position: 1 });

// Case-insensitive (collation strength 2), trimmed (via the schema's own
// `trim: true`) uniqueness per job — this is what makes "Technical
// Interview" and " technical interview " conflict at the database level,
// not just in a service-layer pre-check, so the rule holds under
// concurrent requests too. Different Jobs may reuse the same stage name
// freely since job_id is part of the compound key.
hiringStepSchema.index(
  { job_id: 1, name: 1 },
  { unique: true, collation: { locale: "en", strength: 2 } }
);

// Deliberately NOT unique on { job_id, position }. A unique index there
// would make the reorder operation (which must reassign several
// documents' positions in one logical move) transiently violate it —
// e.g. swapping positions 0 and 1 collides the moment either update
// lands before the other. Implementing a collision-free two-phase
// (offset-then-final) update strategy to support a unique index safely
// was judged unnecessary complexity for what is a low-contention,
// HR-admin-only operation: the realistic risk is two admins reordering or
// creating a stage for the exact same Job in the same instant, and the
// worst-case outcome of losing that race is a temporary display-order
// oddity self-corrected by the next reorder/read — not data loss or a
// security issue. See hiringStep.service.ts's reorderHiringSteps() and
// createHiringStep() for where this is handled (a single bulkWrite for
// reorder; no unique-position constraint to violate).
export type HiringStepDoc = HydratedDocument<InferSchemaType<typeof hiringStepSchema>>;

export const HiringStep = model("HiringStep", hiringStepSchema);
