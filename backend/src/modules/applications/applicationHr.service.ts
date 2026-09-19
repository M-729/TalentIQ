import { Types, type FilterQuery } from "mongoose";
import { Application, type ApplicationDoc, type ApplicationStatus } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { AIScreening } from "../../models/AIScreening.model";
import { NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";
import { escapeRegExp } from "../../utils/regex";
import { getAccessibleApplication } from "./applicationAccess.service";
import {
  serializeApplicationDetail,
  serializeApplicationListRow,
  type ApplicationDetailDTO,
  type ApplicationListRowDTO,
  type ScreeningSummary,
} from "./applicationHr.serializer";

export interface ListApplicationsFilters {
  status?: ApplicationStatus;
  jobId?: string;
  search?: string;
  page: number;
  limit: number;
}

export interface ListApplicationsResult {
  applications: ApplicationListRowDTO[];
  total: number;
}

/**
 * Latest stored AIScreening score/timestamp per application, in one
 * aggregation query regardless of how many applications are passed in —
 * this is what keeps the list endpoint from doing one screening lookup
 * per row (N+1). Reads only already-persisted AIScreening documents:
 * no Groq call, no R2 access, no CV parsing, and no score is ever
 * recalculated here.
 */
async function getLatestScreeningSummaries(applicationIds: string[]): Promise<Map<string, ScreeningSummary>> {
  if (applicationIds.length === 0) {
    return new Map();
  }

  const results = await AIScreening.aggregate<{
    _id: Types.ObjectId;
    latestScore: number | null;
    latestScreenedAt: Date;
  }>([
    { $match: { application_id: { $in: applicationIds.map((id) => new Types.ObjectId(id)) } } },
    { $sort: { created_at: -1 } },
    {
      $group: {
        _id: "$application_id",
        latestScore: { $first: "$match.score" },
        latestScreenedAt: { $first: "$created_at" },
      },
    },
  ]);

  const summaries = new Map<string, ScreeningSummary>();
  for (const result of results) {
    summaries.set(result._id.toString(), {
      hasScreening: true,
      latestScore: result.latestScore,
      latestScreenedAt: result.latestScreenedAt,
    });
  }
  return summaries;
}

/**
 * Company-scoped Applications list for the HR ATS view. Tenant isolation
 * is enforced by construction: applications are only ever fetched via a
 * job_id filter derived from this company's own Jobs (or a single Job
 * already verified to belong to this company) — never by trusting a
 * caller-supplied company id, and a jobId filter for another company's
 * Job is rejected as 404 before any Application query runs.
 */
export async function listApplications(companyId: string, filters: ListApplicationsFilters): Promise<ListApplicationsResult> {
  let jobFilter: FilterQuery<ApplicationDoc>;
  if (filters.jobId) {
    await assertOwnedByCompany(Job, { _id: filters.jobId }, companyId, { notFoundMessage: "Job not found" });
    jobFilter = { job_id: filters.jobId };
  } else {
    const companyJobs = await Job.find(companyFilter(companyId)).select("_id").lean();
    jobFilter = { job_id: { $in: companyJobs.map((job) => job._id) } };
  }

  let candidateFilter: FilterQuery<ApplicationDoc> = {};
  if (filters.search) {
    // Case-insensitive substring match on name/email — a reasonable ATS
    // search without over-engineering full-text search for this ticket.
    const pattern = new RegExp(escapeRegExp(filters.search), "i");
    const matchingCandidates = await Candidate.find({ $or: [{ full_name: pattern }, { email: pattern }] })
      .select("_id")
      .lean();
    // An empty match list correctly yields zero applications below ($in: []
    // matches nothing) rather than being treated as "no filter".
    candidateFilter = { candidate_id: { $in: matchingCandidates.map((candidate) => candidate._id) } };
  }

  const filter: FilterQuery<ApplicationDoc> = {
    ...jobFilter,
    ...candidateFilter,
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [applications, total] = await Promise.all([
    Application.find(filter)
      .sort({ applied_at: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit),
    Application.countDocuments(filter),
  ]);

  const candidateIds = [...new Set(applications.map((application) => application.candidate_id.toString()))];
  const jobIds = [...new Set(applications.map((application) => application.job_id.toString()))];

  // Two more batched queries (never one per row) to resolve candidate/job
  // context for the whole page at once.
  const [candidates, jobs, screeningSummaries] = await Promise.all([
    Candidate.find({ _id: { $in: candidateIds } }),
    Job.find({ _id: { $in: jobIds } }),
    getLatestScreeningSummaries(applications.map((application) => application.id)),
  ]);

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));

  const rows: ApplicationListRowDTO[] = [];
  for (const application of applications) {
    const candidate = candidateById.get(application.candidate_id.toString());
    const job = jobById.get(application.job_id.toString());
    // candidate_id/job_id are required fields, and job_id was already
    // confirmed to belong to this company above — this should always
    // resolve. Guarded rather than asserted: skipping a row is safer
    // than serializing one with a missing candidate/job.
    if (!candidate || !job) continue;
    rows.push(serializeApplicationListRow(application, candidate, job, screeningSummaries.get(application.id)));
  }

  return { applications: rows, total };
}

/**
 * Company-scoped Application detail. Reuses getAccessibleApplication for
 * the exact same tenant-authorization semantics as the AI screening
 * routes (404 for nonexistent/cross-company, never 403).
 */
export async function getApplicationDetail(applicationId: string, companyId: string): Promise<ApplicationDetailDTO> {
  const application = await getAccessibleApplication(applicationId, companyId);

  const [candidate, job, screeningSummaries] = await Promise.all([
    Candidate.findById(application.candidate_id),
    Job.findById(application.job_id),
    getLatestScreeningSummaries([application.id]),
  ]);

  // Defensive, not expected in practice: candidate_id is required on every
  // Application, and job_id was already confirmed to belong to this
  // company by getAccessibleApplication above.
  if (!candidate || !job) {
    throw new NotFoundError("Application not found");
  }

  return serializeApplicationDetail(application, candidate, job, screeningSummaries.get(application.id));
}
