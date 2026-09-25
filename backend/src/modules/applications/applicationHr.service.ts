import { Types, type FilterQuery } from "mongoose";
import { Application, type ApplicationDoc, type ApplicationStatus } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { HiringStep } from "../../models/HiringStep.model";
import { AIScreening } from "../../models/AIScreening.model";
import { AIScreeningRun } from "../../models/AIScreeningRun.model";
import { NotFoundError } from "../../security/AppError";
import { companyFilter } from "../../security/companyScope";
import { escapeRegExp } from "../../utils/regex";
import { resolveReportedStatus } from "../../services/ai/screeningRun.service";
import { getAccessibleApplication } from "./applicationAccess.service";
import { resolveJobId } from "../jobs/job.service";
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
 * Latest stored AIScreening score/timestamp PLUS the current
 * initial-screening lifecycle status, per application, in TWO batched
 * queries total regardless of how many applications are passed in — this
 * is what keeps the list/detail/Pipeline endpoints from doing one
 * screening lookup per row (N+1). Reads only already-persisted
 * AIScreening/AIScreeningRun documents: no Groq call, no R2 access, no CV
 * parsing, and no score is ever recalculated here. Shared verbatim by
 * applicationHr.service.ts's list/detail and
 * hiringPipelineBoard.service.ts — a single source of truth for "what is
 * this Application's screening state right now".
 *
 * Status resolution per application reuses
 * screeningRun.service.ts's resolveReportedStatus (the exact same
 * function getEffectiveScreeningState uses for a single Application) so
 * stale-processing detection and the persisted-success-wins rule can
 * never drift between the single-Application and batched read paths: a
 * real AIScreeningRun row's own status is authoritative unless it's a
 * "processing" row stuck past the configured timeout, in which case it
 * reports as "stale_processing" (or "completed", if a screening was
 * actually persisted despite the crash); absent a row entirely, a
 * completed AIScreening (legacy data that predates this feature) reports
 * as "completed"; absent both, "not_started". This function itself never
 * writes — see reserveScreeningRunForProcessing for where a
 * stale/actually-completed row is self-healed, once someone attempts to
 * act on it.
 */
export async function getLatestScreeningSummaries(applicationIds: string[]): Promise<Map<string, ScreeningSummary>> {
  if (applicationIds.length === 0) {
    return new Map();
  }

  const objectIds = applicationIds.map((id) => new Types.ObjectId(id));

  const [screeningResults, runs] = await Promise.all([
    AIScreening.aggregate<{
      _id: Types.ObjectId;
      latestScore: number | null;
      latestScreenedAt: Date;
    }>([
      { $match: { application_id: { $in: objectIds } } },
      { $sort: { created_at: -1 } },
      {
        $group: {
          _id: "$application_id",
          latestScore: { $first: "$match.score" },
          latestScreenedAt: { $first: "$created_at" },
        },
      },
    ]),
    AIScreeningRun.find({ application_id: { $in: objectIds } })
      .select("application_id status attempted_at")
      .lean(),
  ]);

  const latestByApplication = new Map(screeningResults.map((result) => [result._id.toString(), result]));
  const runByApplication = new Map(runs.map((run) => [run.application_id.toString(), run]));

  const summaries = new Map<string, ScreeningSummary>();
  for (const applicationId of applicationIds) {
    const latest = latestByApplication.get(applicationId);
    const run = runByApplication.get(applicationId) ?? null;
    const status = resolveReportedStatus(run, !!latest);
    summaries.set(applicationId, {
      status,
      latestScore: latest?.latestScore ?? null,
      latestScreenedAt: latest?.latestScreenedAt ?? null,
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
    // filters.jobId is a dual-accept public_id-or-ObjectId (see
    // job.service.ts's resolveJobId) — resolved to the real internal id
    // here before being used against Application.job_id, which is always
    // a plain ObjectId reference and was never itself migrated.
    const resolvedJobId = await resolveJobId(companyId, filters.jobId);
    if (!resolvedJobId) {
      throw new NotFoundError("Job not found");
    }
    jobFilter = { job_id: resolvedJobId };
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
  const currentStepIds = [
    ...new Set(applications.filter((application) => application.current_step_id).map((application) => application.current_step_id!.toString())),
  ];

  // Batched queries (never one per row) to resolve candidate/job/current-
  // stage context for the whole page at once — the "Pipeline Stage" column
  // needs the live HiringStep name, same batching precedent as
  // getLatestScreeningSummaries below and hiringPipelineBoard.service.ts's
  // own current-step resolution.
  const [candidates, jobs, screeningSummaries, currentSteps] = await Promise.all([
    Candidate.find({ _id: { $in: candidateIds } }),
    Job.find({ _id: { $in: jobIds } }),
    getLatestScreeningSummaries(applications.map((application) => application.id)),
    currentStepIds.length ? HiringStep.find({ _id: { $in: currentStepIds } }) : Promise.resolve([]),
  ]);

  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const jobById = new Map(jobs.map((job) => [job.id, job]));
  const currentStepById = new Map(currentSteps.map((step) => [step.id, step]));

  const rows: ApplicationListRowDTO[] = [];
  for (const application of applications) {
    const candidate = candidateById.get(application.candidate_id.toString());
    const job = jobById.get(application.job_id.toString());
    // candidate_id/job_id are required fields, and job_id was already
    // confirmed to belong to this company above — this should always
    // resolve. Guarded rather than asserted: skipping a row is safer
    // than serializing one with a missing candidate/job.
    if (!candidate || !job) continue;
    const currentStep = application.current_step_id ? (currentStepById.get(application.current_step_id.toString()) ?? null) : null;
    rows.push(serializeApplicationListRow(application, candidate, job, screeningSummaries.get(application.id), currentStep));
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

  const [candidate, job, screeningSummaries, currentStep] = await Promise.all([
    Candidate.findById(application.candidate_id),
    Job.findById(application.job_id),
    getLatestScreeningSummaries([application.id]),
    // Resolved from the LIVE HiringStep (never a snapshot) — see
    // ApplicationDetailDTO.current_step's own doc comment. null when the
    // Application has no current stage, or (defensively) if
    // current_step_id points at a stage that no longer resolves.
    application.current_step_id ? HiringStep.findById(application.current_step_id).select("name type") : null,
  ]);

  // Defensive, not expected in practice: candidate_id is required on every
  // Application, and job_id was already confirmed to belong to this
  // company by getAccessibleApplication above.
  if (!candidate || !job) {
    throw new NotFoundError("Application not found");
  }

  return serializeApplicationDetail(application, candidate, job, screeningSummaries.get(application.id), currentStep);
}
