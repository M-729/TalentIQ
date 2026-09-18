import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Per ERD/BRD: candidates are global entities, never company-owned. They
// have no password, role, or auth fields at all — candidates never have a
// TalentIQ account. Company ownership of an application (not the
// candidate) is derived through application.job_id -> job.company_id.
const candidateSchema = new Schema(
  {
    full_name: { type: String, required: true, trim: true },
    // Global uniqueness (not scoped per company) is the chosen candidate-
    // identity rule — see application.service.ts / task report for why.
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    location: { type: String, trim: true },
    linkedin_url: { type: String, trim: true },
    portfolio_url: { type: String, trim: true },
    // No cv_file_url here — approved architecture change (Secure CV
    // Upload ticket): a candidate may apply to different jobs with
    // different CV versions, and AI screening must analyze the exact CV
    // submitted for a given application, so the CV belongs to Application
    // (see cv_file on Application.model.ts), not to Candidate. The ERD
    // still shows Candidate.cv_file_url and needs updating to reflect
    // this — flagged in the task report, not silently left inconsistent.
  },
  {
    // ERD lists only created_at for candidates, no updated_at.
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

export type CandidateDoc = HydratedDocument<InferSchemaType<typeof candidateSchema>>;

export const Candidate = model("Candidate", candidateSchema);
