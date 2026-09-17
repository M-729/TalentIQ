import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Per ERD: only "status" is an enumerated field on jobs. employment_type and
// experience_level are plain strings in the ERD (no enumerated values given
// in the BRD/ERD), so they stay free-text here rather than inventing an enum.
export const JOB_STATUSES = ["draft", "active", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

const jobSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    created_by: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true, trim: true },
    department: { type: String, trim: true },
    description: { type: String, trim: true },
    required_skills: [{ type: String, trim: true }],
    experience_level: { type: String, trim: true },
    location: { type: String, trim: true },
    employment_type: { type: String, trim: true },
    salary_min: { type: Number, min: 0 },
    salary_max: { type: Number, min: 0 },
    status: { type: String, enum: JOB_STATUSES, default: "draft", required: true },
    published_at: { type: Date },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Covers the normal company-scoped access patterns: "this company's jobs"
// (either index serves that alone via its leading field), "this company's
// jobs filtered by status" (e.g. active jobs for a public listing), and
// "this company's jobs, most recent first" (default dashboard ordering).
jobSchema.index({ company_id: 1, status: 1 });
jobSchema.index({ company_id: 1, created_at: -1 });

export type JobDoc = HydratedDocument<InferSchemaType<typeof jobSchema>>;

export const Job = model("Job", jobSchema);
