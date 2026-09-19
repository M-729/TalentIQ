import { Application, type ApplicationDoc } from "../../models/Application.model";
import { Job } from "../../models/Job.model";
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
  const application = await Application.findById(applicationId);
  if (!application) {
    throw new NotFoundError("Application not found");
  }

  await assertOwnedByCompany(Job, { _id: application.job_id }, companyId, { notFoundMessage: "Application not found" });

  return application;
}
