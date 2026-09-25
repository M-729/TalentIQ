// Mirrors backend Job.model.ts / job.controller.ts response shape exactly.
// Keep in sync if the backend model changes.
export const JOB_STATUSES = ["draft", "active", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export interface Job {
  _id: string;
  // Opaque, URL-safe identifier — prefer this over `_id` for any
  // URL/navigation use. Optional only because a Job created before this
  // field existed may not have one until the backend backfill runs; once
  // that's complete for an environment, it's present on every Job.
  public_id?: string;
  company_id: string;
  created_by: string;
  title: string;
  department?: string;
  description?: string;
  required_skills: string[];
  experience_level?: string;
  location?: string;
  employment_type?: string;
  salary_min?: number;
  salary_max?: number;
  status: JobStatus;
  published_at?: string;
  created_at: string;
  updated_at: string;
}

// Writable fields only — mirrors backend job.validation.ts exactly.
// company_id, created_by, published_at, created_at, updated_at are all
// backend-controlled and deliberately absent here.
export interface CreateJobInput {
  title: string;
  department?: string;
  description?: string;
  required_skills?: string[];
  experience_level?: string;
  location?: string;
  employment_type?: string;
  salary_min?: number;
  salary_max?: number;
  status?: JobStatus;
}

export type UpdateJobInput = Partial<CreateJobInput>;
