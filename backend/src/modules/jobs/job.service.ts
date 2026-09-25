import { Job, NOT_DELETED_JOB_FILTER, jobIdentifierFilter, type JobDoc, type JobStatus } from "../../models/Job.model";
import { NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import type { CreateJobInput, UpdateJobInput } from "./job.validation";

// Safety net only, not an expected path: public_id is 96 random bits (see
// utils/publicId.ts), so a collision on insert is not realistically going
// to happen at any Job volume this product will ever reach. A bounded
// retry is simply cheaper than leaving an insert permanently failing in
// the astronomically unlikely event it does.
const MAX_PUBLIC_ID_COLLISION_RETRIES = 3;

export async function createJob(companyId: string, createdBy: string, input: CreateJobInput): Promise<JobDoc> {
  // deleted_at is not part of CreateJobInput (see job.validation.ts), so
  // the schema's own `default: null` always applies here — a client can
  // never create a Job that starts out soft-deleted. public_id is likewise
  // never accepted from input — it's assigned by Job.model.ts's own
  // pre("validate") hook on every attempt below (a fresh document each
  // time, so a retry after a collision generates a fresh random value).
  for (let attempt = 1; attempt <= MAX_PUBLIC_ID_COLLISION_RETRIES; attempt++) {
    try {
      return await Job.create({
        ...input,
        company_id: companyId,
        created_by: createdBy,
      });
    } catch (err) {
      const isLastAttempt = attempt === MAX_PUBLIC_ID_COLLISION_RETRIES;
      if (!isDuplicateKeyError(err) || err.keyValue?.public_id === undefined || isLastAttempt) {
        throw err;
      }
      // Any other duplicate key (there are none on Job today besides
      // public_id) would also reach here — keyValue.public_id being
      // present is what confirms this specific collision is retryable.
    }
  }
  // Unreachable: the loop always either returns or throws above.
  throw new Error("Failed to create job after public_id collision retries");
}

/**
 * Resolves the Job's public_id URL/query id (public-id only since the
 * Phase 2 cutover) to the Job's real Mongo _id, scoped to the caller's
 * company — the one
 * place every OTHER module's own "jobId" parameter/filter/path-segment
 * gets translated into the real internal id it actually needs for its own
 * `job_id` queries. Returns null (never throws) so each caller decides
 * for itself what "doesn't resolve" means in its own context: a 404 for a
 * path segment identifying a specific Job resource (e.g.
 * hiringStep.service.ts's own Job-ownership gate), or an empty result set
 * for an optional list/filter query param (e.g.
 * applicationHr.service.ts's listApplications jobId filter) — this
 * function itself is deliberately policy-free.
 *
 * Does NOT check NOT_DELETED_JOB_FILTER — callers that care whether the
 * Job is soft-deleted apply that the same way they already did before
 * (this only replaces how the id itself is matched, never what else the
 * caller additionally requires).
 */
export async function resolveJobId(companyId: string, jobIdParam: string): Promise<string | null> {
  const job = await Job.findOne({ ...jobIdentifierFilter(jobIdParam), ...companyFilter(companyId) }).select("_id");
  return job ? job.id : null;
}

/** Normal Job management list — excludes soft-deleted Jobs regardless of status filter. */
export async function listJobs(companyId: string, status?: JobStatus): Promise<JobDoc[]> {
  const filter = { ...companyFilter(companyId), ...NOT_DELETED_JOB_FILTER, ...(status ? { status } : {}) };
  return Job.find(filter).sort({ created_at: -1 });
}

export async function getJob(companyId: string, jobId: string): Promise<JobDoc> {
  await assertOwnedByCompany(Job, { ...jobIdentifierFilter(jobId), ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });

  const job = await Job.findOne({ ...jobIdentifierFilter(jobId), ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError("Job not found");
  }
  return job;
}

export async function updateJob(companyId: string, jobId: string, input: UpdateJobInput): Promise<JobDoc> {
  await assertOwnedByCompany(Job, { ...jobIdentifierFilter(jobId), ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });

  // input never contains deleted_at (absent from updateJobSchema, and Zod
  // strips unlisted keys by default) — an ordinary PATCH can never restore
  // a soft-deleted Job by clearing deleted_at, nor set it.
  const job = await Job.findOne({ ...jobIdentifierFilter(jobId), ...NOT_DELETED_JOB_FILTER });
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
  await assertOwnedByCompany(Job, { ...jobIdentifierFilter(jobId), ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });
  await Job.updateOne(jobIdentifierFilter(jobId), { $set: { deleted_at: new Date() } });
}
