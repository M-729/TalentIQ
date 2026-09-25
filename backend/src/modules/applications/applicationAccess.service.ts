import { Application, applicationIdentifierFilter, type ApplicationDoc } from "../../models/Application.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany } from "../../security/companyScope";

/**
 * Resolves an Application and verifies it belongs — via its Job — to the
 * given company. This is the one place tenant-resolution logic for
 * Application-scoped routes lives, so it isn't repeated per controller
 * (Application has no company_id of its own; ownership only exists
 * through application.job_id -> Job.company_id, see companyScope.ts).
 *
 * Denies as 404 for every one of: a nonexistent Application, an
 * Application whose Job no longer resolves, and an Application belonging
 * to a different company — deliberately the same status and message for
 * all three, so an unauthorized caller can never distinguish "doesn't
 * exist" from "belongs to someone else" for an id they don't own.
 *
 * Authorization only — performs no AI, CV extraction, or R2 work, so
 * callers can safely run this before any costly operation.
 *
 * Returns the FULL Application document (not just job_id) — earlier
 * callers (screening.service.ts) only ever needed the ownership check
 * and discard the return value, so returning the complete document costs
 * them nothing, while the HR Applications Management endpoints (which
 * need candidate_id/status/source/applied_at/cv_file for serialization)
 * can reuse this same helper instead of a second near-duplicate query.
 */
export async function getAccessibleApplication(applicationId: string, companyId: string): Promise<ApplicationDoc> {
  const application = await Application.findOne(applicationIdentifierFilter(applicationId));
  if (!application) {
    throw new NotFoundError("Application not found");
  }

  await assertOwnedByCompany(Job, { _id: application.job_id }, companyId, { notFoundMessage: "Application not found" });

  return application;
}

/**
 * Same tenant-resolution semantics as getAccessibleApplication, plus one
 * extra gate: the Application's Job must NOT be soft-deleted. Use this
 * (never the plain function above) for any ACTIVE pipeline-management
 * operation on an Application — currently, stage movement
 * (stageTransition.service.ts's moveApplicationStage). Reading history
 * must keep working after the Job is soft-deleted, so history reads keep
 * using getAccessibleApplication instead; only the write path gates on
 * the Job still being active — the same active-vs-historical split
 * hiringStep.service.ts already applies to pipeline management, and
 * screening.service.ts's createScreening applies to new-screening
 * creation.
 *
 * Denies as 404 ("Job not found") for a soft-deleted Job, matching
 * hiringStep.service.ts's own NOT_DELETED_JOB_FILTER-gated checks — a
 * soft-deleted Job's pipeline is simply unavailable for active management
 * through this path, the same as it is there.
 */
export async function getAccessibleApplicationForActiveJob(applicationId: string, companyId: string): Promise<ApplicationDoc> {
  const application = await Application.findOne(applicationIdentifierFilter(applicationId));
  if (!application) {
    throw new NotFoundError("Application not found");
  }

  await assertOwnedByCompany(Job, { _id: application.job_id, ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });

  return application;
}
