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
 */
export async function getAccessibleApplication(applicationId: string, companyId: string): Promise<ApplicationDoc> {
  const application = await Application.findById(applicationId).select("job_id");
  if (!application) {
    throw new NotFoundError("Application not found");
  }

  await assertOwnedByCompany(Job, { _id: application.job_id }, companyId, { notFoundMessage: "Application not found" });

  return application;
}
