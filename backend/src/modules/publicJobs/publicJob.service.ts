import type { FilterQuery } from "mongoose";
import { Job, NOT_DELETED_JOB_FILTER, jobIdentifierFilter, type JobDoc } from "../../models/Job.model";
import { Company } from "../../models/Company.model";
import { NotFoundError } from "../../security/AppError";
import { escapeRegExp } from "../../utils/regex";
import type { ListPublicJobsQuery } from "./publicJob.validation";

// Explicit allowlist, not a blocklist over the raw Mongoose document — new
// internal fields added to Job.model.ts in the future are safe by default
// (excluded) rather than silently leaking through this endpoint. Never
// includes company_id, created_by, deleted_at, or any other internal/
// tenant field — only company_name (a display value, not the id) is
// resolved in, for both the list and detail shapes below.
export interface PublicJob {
  // The only URL-facing identifier this response exposes (Phase 2 cutover)
  // — every Job is backfilled and auto-assigned public_id on creation, so
  // the internal Mongo _id is no longer included here at all: a public,
  // unauthenticated endpoint has no reason to expose a raw database id.
  public_id: string;
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

/**
 * The one place a Job document is narrowed to its public-safe shape — used
 * by both the list and detail endpoints, so they can never drift from each
 * other on what's safe to expose.
 */
function toPublicJob(job: JobDoc, companyName: string | undefined): PublicJob {
  return {
    public_id: job.public_id!,
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
    company_name: companyName,
  };
}

/**
 * The single publication rule for candidate-facing visibility, shared by
 * both listPublicJobs and getPublicJob below: status must be "active" AND
 * the Job must not be soft-deleted. There is no separate "accepting
 * applications" flag on Job.model.ts — "active" already IS that state (see
 * job.service.ts's updateJob, which only ever sets published_at the first
 * time status becomes "active"). A draft or closed Job, or a soft-deleted
 * one regardless of status, never matches this filter.
 */
function publicJobFilter(): FilterQuery<JobDoc> {
  return { status: "active", ...NOT_DELETED_JOB_FILTER };
}

export async function getPublicJob(jobId: string): Promise<PublicJob> {
  // Scoping the query itself to the publication filter (rather than
  // fetching by id and checking after) means a draft/closed/soft-deleted
  // job's existence is never distinguishable from a nonexistent one — none
  // of them match, so all resolve as the same 404 below.
  const job = await Job.findOne({ ...jobIdentifierFilter(jobId), ...publicJobFilter() });
  if (!job) {
    throw new NotFoundError("Job not found");
  }

  const company = await Company.findById(job.company_id).select("name").lean();
  return toPublicJob(job, company?.name);
}

export interface ListPublicJobsFilters {
  search?: ListPublicJobsQuery["search"];
  location?: ListPublicJobsQuery["location"];
  employmentType?: ListPublicJobsQuery["employmentType"];
  department?: ListPublicJobsQuery["department"];
  page: number;
  limit: number;
}

export interface ListPublicJobsResult {
  jobs: PublicJob[];
  total: number;
}

/**
 * The public, cross-tenant Careers listing — deliberately NOT scoped to
 * any one company (there is no companyId filter here at all): this is a
 * shared board of every company's publicly active Jobs, matching the
 * "candidate discovers opportunities across TalentIQ" product intent.
 * Every row is still narrowed through the exact same toPublicJob allowlist
 * as getPublicJob, so a Job appearing here from company A never leaks
 * company A's internal id or any other tenant-identifying field beyond its
 * own display name.
 *
 * search/location/employmentType/department are case-insensitive
 * substring filters — location/employment_type/department are free-text
 * fields on Job.model.ts (no fixed enum), so a substring match is the only
 * filter that makes sense without inventing structure the model doesn't
 * have.
 */
export async function listPublicJobs(filters: ListPublicJobsFilters): Promise<ListPublicJobsResult> {
  const filter: FilterQuery<JobDoc> = publicJobFilter();
  if (filters.search) filter.title = new RegExp(escapeRegExp(filters.search), "i");
  if (filters.location) filter.location = new RegExp(escapeRegExp(filters.location), "i");
  if (filters.employmentType) filter.employment_type = new RegExp(escapeRegExp(filters.employmentType), "i");
  if (filters.department) filter.department = new RegExp(escapeRegExp(filters.department), "i");

  const [jobs, total] = await Promise.all([
    Job.find(filter)
      .sort({ published_at: -1, _id: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit),
    Job.countDocuments(filter),
  ]);

  const companyIds = [...new Set(jobs.map((job) => job.company_id.toString()))];
  const companies = companyIds.length > 0 ? await Company.find({ _id: { $in: companyIds } }).select("name").lean() : [];
  const companyNameById = new Map(companies.map((company) => [company._id.toString(), company.name]));

  return {
    jobs: jobs.map((job) => toPublicJob(job, companyNameById.get(job.company_id.toString()))),
    total,
  };
}
