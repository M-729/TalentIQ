import type { Types } from "mongoose";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { companyFilter } from "../../security/companyScope";

export interface CompanyJobScope {
  /** Every non-soft-deleted Job this company owns — the set every Application/Interview aggregation (neither has a direct company_id) must filter job_id against, since Application/Interview are only ever reached indirectly via Job -> company_id (see security/companyScope.ts's own "indirectly-owned collections" doc comment). */
  jobIds: Types.ObjectId[];
  /** How many of those are `status: "active"` — resolved from the SAME query as jobIds so "Open Jobs" can never be defined differently in two places (Dashboard vs Hiring Analytics). */
  openJobsCount: number;
}

/**
 * The single shared "what does this company's Job set look like right now"
 * resolution — reused by both dashboard.service.ts and
 * hiringAnalytics.service.ts so a Job/Application/Interview KPI is never
 * defined subtly differently between the two pages. One query, not
 * per-caller duplication; see this ticket's explicit Part 18 "avoid
 * duplicating business definitions between Dashboard and Analytics" rule.
 */
export async function resolveCompanyJobScope(companyId: string): Promise<CompanyJobScope> {
  const jobs = await Job.find({ ...companyFilter(companyId), ...NOT_DELETED_JOB_FILTER })
    .select("_id status")
    .lean();
  return {
    jobIds: jobs.map((job) => job._id),
    openJobsCount: jobs.filter((job) => job.status === "active").length,
  };
}
