import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { NotFoundError } from "../../security/AppError";

// Explicit allowlist, not a blocklist over the raw Mongoose document — new
// internal fields added to Job.model.ts in the future are safe by default
// (excluded) rather than silently leaking through this endpoint.
export interface PublicJob {
  _id: string;
  title: string;
  department?: string;
  description?: string;
  required_skills: string[];
  experience_level?: string;
  location?: string;
  employment_type?: string;
  salary_min?: number;
  salary_max?: number;
  published_at?: Date;
  company_name?: string;
}

export async function getPublicJob(jobId: string): Promise<PublicJob> {
  // Scoping the query itself to status: "active" and NOT_DELETED_JOB_FILTER
  // (rather than fetching by id and checking after) means a
  // draft/closed/soft-deleted job's existence is never distinguishable
  // from a nonexistent one — none of them match, so all resolve as the
  // same 404 below. A soft-deleted Job must never be publicly reachable
  // even if its status somehow remains "active".
  const job = await Job.findOne({ _id: jobId, status: "active", ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError("Job not found");
  }

  const company = await Company.findById(job.company_id).select("name").lean();

  return {
    _id: job._id.toString(),
    title: job.title,
    department: job.department ?? undefined,
    description: job.description ?? undefined,
    required_skills: job.required_skills,
    experience_level: job.experience_level ?? undefined,
    location: job.location ?? undefined,
    employment_type: job.employment_type ?? undefined,
    salary_min: job.salary_min ?? undefined,
    salary_max: job.salary_max ?? undefined,
    published_at: job.published_at ?? undefined,
    company_name: company?.name,
  };
}
