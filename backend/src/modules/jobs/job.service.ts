import { Job, NOT_DELETED_JOB_FILTER, type JobDoc, type JobStatus } from "../../models/Job.model";
import { NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";
import type { CreateJobInput, UpdateJobInput } from "./job.validation";

export async function createJob(companyId: string, createdBy: string, input: CreateJobInput): Promise<JobDoc> {
  // deleted_at is not part of CreateJobInput (see job.validation.ts), so
  // the schema's own `default: null` always applies here — a client can
  // never create a Job that starts out soft-deleted.
  return Job.create({
    ...input,
    company_id: companyId,
    created_by: createdBy,
  });
}

/** Normal Job management list — excludes soft-deleted Jobs regardless of status filter. */
export async function listJobs(companyId: string, status?: JobStatus): Promise<JobDoc[]> {
  const filter = { ...companyFilter(companyId), ...NOT_DELETED_JOB_FILTER, ...(status ? { status } : {}) };
  return Job.find(filter).sort({ created_at: -1 });
}

export async function getJob(companyId: string, jobId: string): Promise<JobDoc> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });

  const job = await Job.findOne({ _id: jobId, ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError("Job not found");
  }
  return job;
}

export async function updateJob(companyId: string, jobId: string, input: UpdateJobInput): Promise<JobDoc> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });

  // input never contains deleted_at (absent from updateJobSchema, and Zod
  // strips unlisted keys by default) — an ordinary PATCH can never restore
  // a soft-deleted Job by clearing deleted_at, nor set it.
  const job = await Job.findOne({ _id: jobId, ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError("Job not found");
  }

  Object.assign(job, input);

  // published_at exists in the ERD to record when a job first went live.
  // Set it the first time status becomes "active"; leave it untouched after
  // that (including if the job later moves away from "active"), since it
  // represents the original publish date, not a live/unlive toggle.
  if (input.status === "active" && !job.published_at) {
    job.published_at = new Date();
  }

  await job.save();
  return job;
}

/**
 * Soft delete: sets deleted_at, never physically removes the Job document.
 * Applications, HiringSteps, and AIScreenings that reference this Job (via
 * Application.job_id/current_step_id) are left completely untouched — see
 * Job.model.ts's NOT_DELETED_JOB_FILTER doc comment for why historical
 * resolution paths (e.g. HR viewing a past Application) deliberately keep
 * working after this.
 *
 * Idempotency: the ownership check above already excludes soft-deleted
 * Jobs, so calling this again on an already-deleted Job resolves as 404,
 * identically to a nonexistent or cross-company Job — never revealing that
 * a deleted Job still exists internally.
 */
export async function deleteJob(companyId: string, jobId: string): Promise<void> {
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });
  await Job.updateOne({ _id: jobId }, { $set: { deleted_at: new Date() } });
}
