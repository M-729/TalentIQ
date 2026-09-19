import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Mirrors cvAnalysis.schema.ts's requiredSkillEvidence.status and
// candidateMatch.types.ts's SkillMatchStatus — kept in exact sync since
// this is a snapshot of that already-validated data, not a new taxonomy.
export const SKILL_MATCH_STATUSES = ["found", "not_found", "unclear"] as const;
// Mirrors candidateMatch.types.ts's SkillMatchWeight.
export const SKILL_MATCH_WEIGHTS = [0, 0.5, 1] as const;

/**
 * An AIScreening document is an immutable, append-only SNAPSHOT of one
 * completed screening run — never overwritten and never dynamically
 * recomputed when read. If the Job's required_skills change, the AI
 * model changes, or the scoring formula changes later, older screening
 * documents must keep representing exactly what was calculated at the
 * time they were created. This is why `analysis` and `match` are stored
 * as explicit, bounded subdocuments (not references back to live data,
 * and not an unbounded Mixed blob) — see task report for the full
 * rationale. `score_formula_version` exists so a historical document
 * always says which formula produced it, even after the formula changes.
 *
 * Deliberately NOT persisted here: raw CV text, CV buffer, the Groq
 * prompt/system prompt, the raw provider response, any API key or R2
 * credential, any signed URL, or candidate PII (name/email/phone) — see
 * task report for the full list and reasoning.
 */
const analysisSkillSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    evidence: { type: String, trim: true },
  },
  { _id: false }
);

const analysisRequiredSkillEvidenceSchema = new Schema(
  {
    skill: { type: String, required: true, trim: true },
    status: { type: String, enum: SKILL_MATCH_STATUSES, required: true },
    evidence: { type: String, trim: true },
  },
  { _id: false }
);

const analysisExperienceSchema = new Schema(
  {
    // Nullable, matching CvAnalysisResult.experience.yearsMentioned —
    // not calculated when the AI couldn't determine it from the CV.
    yearsMentioned: { type: Number, default: null },
    summary: { type: String, required: true, trim: true },
  },
  { _id: false }
);

// Snapshot of the validated CvAnalysisResult (see cvAnalysis.schema.ts).
const analysisSnapshotSchema = new Schema(
  {
    summary: { type: String, required: true, trim: true },
    skills: { type: [analysisSkillSchema], default: [] },
    experience: { type: analysisExperienceSchema, required: true },
    education: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },
    requiredSkillEvidence: { type: [analysisRequiredSkillEvidenceSchema], default: [] },
  },
  { _id: false }
);

const matchBreakdownEntrySchema = new Schema(
  {
    skill: { type: String, required: true, trim: true },
    status: { type: String, enum: SKILL_MATCH_STATUSES, required: true },
    weight: { type: Number, enum: SKILL_MATCH_WEIGHTS, required: true },
    evidence: { type: String, trim: true },
  },
  { _id: false }
);

// Snapshot of the deterministic CandidateMatchResult (see
// candidateMatch.types.ts). `score` is intentionally NOT `required` —
// null is a valid, meaningful value (scorable: false), and Mongoose's
// `required` validator treats null the same as missing.
const matchSnapshotSchema = new Schema(
  {
    score: { type: Number, min: 0, max: 100, default: null },
    scorable: { type: Boolean, required: true },
    reason: { type: String, enum: ["no_required_skills"] },
    totalRequiredSkills: { type: Number, required: true, min: 0 },
    foundSkills: { type: Number, required: true, min: 0 },
    unclearSkills: { type: Number, required: true, min: 0 },
    missingSkills: { type: Number, required: true, min: 0 },
    matchedSkills: { type: [String], default: [] },
    unclearRequiredSkills: { type: [String], default: [] },
    missingRequiredSkills: { type: [String], default: [] },
    breakdown: { type: [matchBreakdownEntrySchema], default: [] },
  },
  { _id: false }
);

// Safe, provider-neutral metadata only — never the raw Groq SDK response,
// never usage/token counts (optional per this ticket; omitted rather than
// restructuring the AI layer to obtain them cleanly — see task report).
const aiMetadataSchema = new Schema(
  {
    provider: { type: String, required: true, trim: true },
    model: { type: String, trim: true },
  },
  { _id: false }
);

const aiScreeningSchema = new Schema(
  {
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    // Always derived from the Application's own job_id at screening-creation
    // time — never accepted from an external caller (there is no API input
    // for this in this ticket, and none should ever be trusted blindly).
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    analysis: { type: analysisSnapshotSchema, required: true },
    match: { type: matchSnapshotSchema, required: true },
    ai_metadata: { type: aiMetadataSchema, required: true },
    score_formula_version: { type: String, required: true, trim: true },
  },
  {
    // Append-only, immutable documents — there is no meaningful
    // updated_at because nothing ever updates one after creation.
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// Supports both read helpers this ticket adds: "does any screening exist
// for this application" and "this application's screenings, newest
// first". Deliberately NOT unique on application_id — screenings are
// append-only history, not a single overwritable record per application.
aiScreeningSchema.index({ application_id: 1, created_at: -1 });

export type AIScreeningDoc = HydratedDocument<InferSchemaType<typeof aiScreeningSchema>>;

export const AIScreening = model("AIScreening", aiScreeningSchema);
