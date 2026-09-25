import { Schema, model, type FilterQuery, type InferSchemaType, type HydratedDocument } from "mongoose";
import { HIRING_STEP_TYPES } from "./HiringStep.model";
import { generatePublicId } from "../utils/publicId";

// Deliberately just three lifecycle states, mirroring HiringStep's own
// small fixed-enum convention — the external exam platform owns whatever
// richer state IT tracks; TalentIQ only records the outcome HR explicitly
// enters. Never derived from `grade` (see this ticket's explicit "HR
// explicitly chooses Passed or Failed" rule — different external exams use
// different passing thresholds, so TalentIQ can never safely infer this).
export const APPLICATION_ASSESSMENT_STATUSES = ["pending", "passed", "failed"] as const;
export type ApplicationAssessmentStatus = (typeof APPLICATION_ASSESSMENT_STATUSES)[number];

/**
 * An explicit, typed snapshot of the HiringStep's identity AT THE MOMENT
 * this assessment was created — never a generic Mixed blob, matching
 * ApplicationStageTransition.model.ts's stepSnapshotSchema and
 * Interview.model.ts's interviewStageSnapshotSchema precedent exactly. A
 * HiringStep may later be renamed, reordered, or (once no longer
 * referenced by an Application's current_step_id) deleted outright — this
 * snapshot is what lets a historical assessment still accurately say what
 * stage it was created under, regardless of any of that. Includes `id` (in
 * addition to name/type) so the snapshot is a fully self-contained object
 * a client can render without cross-referencing hiring_step_id.
 *
 * Deliberately NOT `required: true` at the schema level — a small number
 * of pre-existing (legacy) ApplicationAssessment records were created
 * before this field existed and have no snapshot; the read path falls
 * back to a live HiringStep lookup ONLY for those (see
 * applicationAssessment.service.ts's listAssessmentHistoryForApplication),
 * and this ticket deliberately does not backfill/rewrite that history.
 */
const stageSnapshotSchema = new Schema(
  {
    id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: HIRING_STEP_TYPES, required: true },
  },
  { _id: false }
);

/**
 * Tracks an EXTERNAL assessment/exam TalentIQ never hosts — no questions,
 * no answers, no candidate login, no grading logic lives here. This is
 * purely: "HR pasted this link, invited the candidate by email, and later
 * recorded this outcome." See this ticket's explicit "do not build an
 * internal exam/question system" rule.
 *
 * Deliberately NOT Mongo Mixed anywhere — every field is explicitly typed,
 * matching this codebase's existing convention (ApplicationStageTransition
 * .model.ts, Interview.model.ts, InterviewFeedback.model.ts all do the
 * same).
 */
const applicationAssessmentSchema = new Schema(
  {
    // Opaque, URL-facing identifier — see utils/publicId.ts and
    // Job.model.ts's public_id field for the full rationale.
    public_id: { type: String, unique: true, sparse: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    // Denormalized from the Application at creation time — same rationale
    // as ApplicationStageTransition.model.ts's own job_id/InterviewCalendar
    // pattern: lets tenant/list queries avoid an extra Application lookup,
    // and stays valid even after the Job is later soft-deleted.
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    // The specific assessment-type HiringStep this record belongs to — see
    // the unique index below. An Application that revisits an
    // assessment-type stage later in a DIFFERENT stage gets its own,
    // separate assessment record; this is never re-resolved dynamically,
    // matching Interview.model.ts's own hiring_step_id precedent. Kept
    // exactly as-is for relationship/current-stage matching (is_current is
    // always computed by comparing THIS field to
    // Application.current_step_id, never by comparing snapshot content —
    // see applicationAssessment.service.ts) — stage_snapshot below is
    // purely a display concern layered on top, never a substitute for it.
    hiring_step_id: { type: Schema.Types.ObjectId, ref: "HiringStep", required: true },
    // Frozen at creation time — see stageSnapshotSchema's own doc comment.
    // Never updated afterward for any reason (a HiringStep rename/reorder/
    // deletion, the candidate moving stages, an assessment result/link
    // edit — none of those ever touch this field again).
    stage_snapshot: { type: stageSnapshotSchema, default: null },

    name: { type: String, required: true, trim: true, maxlength: 150 },
    // http(s) only — enforced primarily by
    // applicationAssessment.validation.ts's Zod schema (the actual
    // security boundary); this maxlength is just a sane storage cap.
    external_url: { type: String, required: true, trim: true, maxlength: 2000 },

    status: { type: String, enum: APPLICATION_ASSESSMENT_STATUSES, required: true, default: "pending" },
    // A coverage-style percentage HR enters by hand — never derived from
    // status, never derived by TalentIQ. Nullable: many real exams report
    // only pass/fail with no numeric score at all.
    grade: { type: Number, min: 0, max: 100, default: null },
    notes: { type: String, trim: true, maxlength: 4000, default: null },

    created_by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updated_by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

    // Set the moment a candidate invitation email is first (successfully
    // OR unsuccessfully) attempted — see
    // applicationAssessmentEmail.service.ts. Distinct from any single
    // EmailNotification row's own sent_at: this is "has an invitation ever
    // been attempted for this assessment", a fast/cheap fact for list/
    // pipeline rendering without joining notification history.
    sent_at: { type: Date, default: null },
    // Set whenever HR records/edits a result — see recordAssessmentResult.
    result_recorded_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Assigns public_id exactly once, only for a brand-new document — same
// pattern/rationale as Job.model.ts's own pre("validate") hook.
applicationAssessmentSchema.pre("validate", function assignPublicId(next) {
  if (this.isNew && !this.public_id) {
    this.public_id = generatePublicId("assess");
  }
  next();
});

// At most one assessment per (Application, HiringStep) — see this
// ticket's explicit Part 4. A double-click/retry on "Add Assessment"
// collides here rather than creating a duplicate record.
applicationAssessmentSchema.index({ application_id: 1, hiring_step_id: 1 }, { unique: true });

// Serves the /assessments company-wide list (optionally filtered by
// job_id/status) directly from the index — see
// applicationAssessment.service.ts's listAssessments.
applicationAssessmentSchema.index({ company_id: 1, created_at: -1 });
applicationAssessmentSchema.index({ company_id: 1, job_id: 1 });
applicationAssessmentSchema.index({ company_id: 1, status: 1 });

export type ApplicationAssessmentDoc = HydratedDocument<InferSchemaType<typeof applicationAssessmentSchema>>;
type ApplicationAssessmentShape = InferSchemaType<typeof applicationAssessmentSchema>;

/** URL/route id resolution for ApplicationAssessment — see Job.model.ts's jobIdentifierFilter for the full rationale. Public-id only (Phase 2 cutover). */
export function applicationAssessmentIdentifierFilter(idParam: string): FilterQuery<ApplicationAssessmentShape> {
  return { public_id: idParam };
}

// The plain (non-Mongoose-subdocument) shape callers build to persist a
// new stage_snapshot — same rationale as EmailNotification.model.ts's own
// EventSnapshot/AssessmentSnapshot re-exports.
export type StageSnapshot = InferSchemaType<typeof stageSnapshotSchema>;

export const ApplicationAssessment = model("ApplicationAssessment", applicationAssessmentSchema);
