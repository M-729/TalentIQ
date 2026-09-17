import type { FilterQuery, Model } from "mongoose";
import { NotFoundError } from "./AppError";

/**
 * Central primitive for enforcing multi-tenant isolation.
 *
 * Usage patterns:
 *
 * 1. Directly company-owned collections (User, Job, EmailTemplate, AuditLog, ...
 *    anything with its own `company_id` field): pass that model/filter directly.
 *
 *      await assertOwnedByCompany(Job, { _id: jobId }, req.auth.companyId);
 *
 * 2. Indirectly-owned collections that reach their company through a job
 *    (Application, Candidate-in-pipeline, Interview, AssessmentResult, Offer,
 *    HiringStep, ApplicationStageRecord — i.e. anything hanging off
 *    `application -> job -> company`): resolve the owning job_id first (either
 *    directly on the document, or via its parent application), then reuse this
 *    same primitive against the Job collection. Example, once those models exist:
 *
 *      const application = await Application.findById(applicationId).select("job_id").lean();
 *      if (!application) throw new NotFoundError("Application not found");
 *      await assertOwnedByCompany(Job, { _id: application.job_id }, req.auth.companyId);
 *
 * Access is denied as 404 (not 403): an HR user from Company A must not be able
 * to distinguish "this resource doesn't exist" from "this resource belongs to
 * another company" for a resource ID they don't own.
 */
export async function assertOwnedByCompany<T>(
  model: Model<T>,
  filter: FilterQuery<T>,
  companyId: string,
  options: { companyField?: string; notFoundMessage?: string } = {}
): Promise<void> {
  const companyField = options.companyField ?? "company_id";

  const scopedFilter = {
    ...filter,
    [companyField]: companyId,
  } as FilterQuery<T>;

  const exists = await model.exists(scopedFilter);
  if (!exists) {
    throw new NotFoundError(options.notFoundMessage ?? "Resource not found");
  }
}

/**
 * Builds a Mongo filter that scopes a query to the caller's company, for
 * directly company-owned collections. Spread the result into list/find calls:
 *
 *   Job.find({ ...companyFilter(req.auth.companyId), status: "active" })
 */
export function companyFilter(companyId: string, companyField = "company_id"): Record<string, string> {
  return { [companyField]: companyId };
}
