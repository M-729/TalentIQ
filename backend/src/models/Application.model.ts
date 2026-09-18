import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Per ERD, exactly as listed for applications.
export const APPLICATION_STATUSES = ["applied", "in_process", "rejected", "offered", "hired"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// Approved architecture change (Secure CV Upload ticket): the CV belongs
// to the Application, not the Candidate — a candidate may apply to
// different jobs with different CV versions, and AI screening must
// analyze the exact CV submitted for a given application. This is not in
// the original ERD (which had Candidate.cv_file_url); the ERD needs
// updating to reflect it, flagged in the task report. storage_key is a
// provider-neutral object key (currently a Cloudflare R2 key), deliberately
// not the candidate's own filename — see cvStorage.service.ts. No raw file
// bytes, base64, or storage credentials are ever stored here, only this
// small metadata record.
const cvFileSchema = new Schema(
  {
    storage_key: { type: String, required: true, trim: true },
    original_name: { type: String, required: true, trim: true },
    mime_type: { type: String, required: true, trim: true },
    size_bytes: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const applicationSchema = new Schema(
  {
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    candidate_id: { type: Schema.Types.ObjectId, ref: "Candidate", required: true },
    // HiringStep doesn't exist yet (a later ticket); the ref name matches
    // the ERD's FK so populate() works once that model lands. No
    // HiringStep records are created by this ticket, so this stays null.
    current_step_id: { type: Schema.Types.ObjectId, ref: "HiringStep", default: null },
    status: { type: String, enum: APPLICATION_STATUSES, default: "applied", required: true },
    source: { type: String, trim: true },
    applied_at: { type: Date, required: true, default: Date.now },
    final_decision: { type: String, trim: true },
    // Required: an application cannot exist without a CV as of this
    // ticket — enforced here at the data layer too, not just in the API
    // validation, since the backend is the source of truth.
    cv_file: { type: cvFileSchema, required: true },
  },
  {
    // ERD lists only updated_at for applications — applied_at already
    // records creation time, so there is no separate created_at.
    timestamps: { createdAt: false, updatedAt: "updated_at" },
  }
);

// Chosen duplicate-prevention rule (ERD/BRD are silent on this — flagged in
// the task report): at most one application per candidate per job. Chosen
// deliberately as the simplest safe rule rather than something more
// elaborate (e.g. allowing reapplication after rejection), and enforced at
// the database level so it holds under concurrent requests, not just in
// application code.
applicationSchema.index({ job_id: 1, candidate_id: 1 }, { unique: true });

// Supports the predictable future HR query "this job's applications,
// filtered by status" (mirrors Job.model.ts's own indexing rationale).
applicationSchema.index({ job_id: 1, status: 1 });

export type ApplicationDoc = HydratedDocument<InferSchemaType<typeof applicationSchema>>;

export const Application = model("Application", applicationSchema);
