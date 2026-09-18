import { Job, type JobDoc, type JobStatus } from "../../models/Job.model";
import { NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";
import type { CreateJobInput, UpdateJobInput } from "./job.validation";

export async function createJob(companyId: string, createdBy: string, input: CreateJobInput): Promise<JobDoc> {
  return Job.create({
    ...input,
    company_id: companyId,
    created_by: createdBy,
  });
}

export async function listJobs(companyId: string, status?: JobStatus): Promise<JobDoc[]> {
  const filter = { ...companyFilter(companyId), ...(status ? { status } : {}) };
  return Job.find(filter).sort({ created_at: -1 });
}

export async function getJob(companyId: string, jobId: string): Promise<JobDoc> {
  await assertOwnedByCompany(Job, { _id: jobId }, companyId, { notFoundMessage: "Job not found" });

  const job = await Job.findById(jobId);
  if (!job) {
    throw new NotFoundError("Job not found");
  }
  return job;
}

export async function updateJob(companyId: string, jobId: string, input: UpdateJobInput): Promise<JobDoc> {
  await assertOwnedByCompany(Job, { _id: jobId }, companyId, { notFoundMessage: "Job not found" });

  const job = await Job.findById(jobId);
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

export async function deleteJob(companyId: string, jobId: string): Promise<void> {
  await assertOwnedByCompany(Job, { _id: jobId }, companyId, { notFoundMessage: "Job not found" });
  await Job.deleteOne({ _id: jobId });
}
