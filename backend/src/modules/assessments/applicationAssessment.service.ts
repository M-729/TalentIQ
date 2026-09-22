import { Types, type FilterQuery } from "mongoose";
import {
  ApplicationAssessment,
  type ApplicationAssessmentDoc,
  type ApplicationAssessmentStatus,
} from "../../models/ApplicationAssessment.model";
import { Application } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { HiringStep } from "../../models/HiringStep.model";
import { Job } from "../../models/Job.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany } from "../../security/companyScope";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import { escapeRegExp } from "../../utils/regex";
import { TERMINAL_STATUSES, TERMINAL_STATE_MESSAGE } from "../stageTransitions/stageTransition.service";
import { getAccessibleApplication, getAccessibleApplicationForActiveJob } from "../applications/applicationAccess.service";
import { batchLatestAssessmentEmailStatus } from "./applicationAssessmentEmail.service";
import {
  serializeAssessmentHistoryItem,
  serializeAssessmentListRow,
  type AssessmentHistoryItemDTO,
  type AssessmentListRowDTO,
} from "./applicationAssessment.serializer";
import type { CreateAssessmentInput, RecordAssessmentResultInput, UpdateAssessmentLinkInput } from "./applicationAssessment.validation";

const NOT_ASSESSMENT_STAGE_MESSAGE = "This application is not currently in an assessment-type hiring stage.";
const ALREADY_EXISTS_MESSAGE = "An assessment already exists for this application's current stage.";
const LINK_LOCKED_AFTER_RESULT_MESSAGE = "This assessment's name and link can no longer be edited once a result has been recorded.";

/**
 * Creates the external-assessment tracking record for an Application's
 * CURRENT hiring stage — see this ticket's explicit Part 3 eligibility
 * rules, all reused from existing helpers/constants rather than
 * re-implemented: getAccessibleApplicationForActiveJob is the exact same
 * tenant + "Job not soft-deleted" gate moveApplicationStage already uses
 * (a closed-but-not-deleted Job still permits this; a soft-deleted Job
 * 404s), and TERMINAL_STATUSES is the exact same rejected/offered/hired
 * guard stage movement already enforces.
 *
 * Never creates/schedules/sends anything else — this is purely a
 * database write. No email is ever sent here (see
 * applicationAssessmentEmail.service.ts's explicit, separate "Send
 * Assessment" action).
 */
export async function createAssessment(
  companyId: string,
  userId: string,
  applicationId: string,
  input: CreateAssessmentInput
): Promise<ApplicationAssessmentDoc> {
  const application = await getAccessibleApplicationForActiveJob(applicationId, companyId);

  if (TERMINAL_STATUSES.has(application.status)) {
    throw new ConflictError(TERMINAL_STATE_MESSAGE);
  }
  if (!application.current_step_id) {
    throw new ConflictError(NOT_ASSESSMENT_STAGE_MESSAGE);
  }

  // Scoping the query by job_id makes "the stage belongs to the SAME Job"
  // structurally impossible to bypass, rather than checked after the
  // fact — same precedent as stageTransition.service.ts's target-step
  // lookup.
  const currentStep = await HiringStep.findOne({ _id: application.current_step_id, job_id: application.job_id });
  if (!currentStep || currentStep.type !== "assessment") {
    throw new ConflictError(NOT_ASSESSMENT_STAGE_MESSAGE);
  }

  try {
    return await ApplicationAssessment.create({
      company_id: companyId,
      application_id: application.id,
      job_id: application.job_id,
      hiring_step_id: currentStep.id,
      // Frozen here, once, from the SAME already-validated currentStep —
      // never updated again afterward for any reason (see
      // ApplicationAssessment.model.ts's stage_snapshot doc comment).
      stage_snapshot: { id: currentStep._id, name: currentStep.name, type: currentStep.type },
      name: input.name,
      external_url: input.external_url,
      created_by_user_id: userId,
      updated_by_user_id: userId,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      // A double-click/retry on "Add Assessment", or a genuine second
      // attempt after the first already exists — see this ticket's
      // explicit Part 4. Never a partial/duplicate record.
      throw new ConflictError(ALREADY_EXISTS_MESSAGE);
    }
    throw err;
  }
}

/**
 * The Application Detail page's read — scoped to the Application's
 * CURRENT stage specifically (never "any historical assessment this
 * Application ever had"), matching the unique-per-(application,
 * hiring_step) invariant and this ticket's own UI expectations: moving
 * back into a DIFFERENT assessment-type stage later must show its own
 * fresh "Add Assessment" prompt, not an old stage's record. Uses the
 * HISTORICAL access variant (works after Job soft-delete) so a past
 * assessment stays visible even once the Job is gone — only NEW writes
 * (create/send) are gated on the Job being active.
 */
export async function getAssessmentForCurrentStage(companyId: string, applicationId: string): Promise<ApplicationAssessmentDoc | null> {
  const application = await getAccessibleApplication(applicationId, companyId);
  if (!application.current_step_id) return null;
  return ApplicationAssessment.findOne({ application_id: applicationId, hiring_step_id: application.current_step_id });
}

/**
 * The Application Detail page's FULL assessment history — every record
 * this Application has ever had, across every assessment-type stage it
 * has ever moved through (not just the current one). This is what lets
 * TalentIQ keep a Passed/Failed result readable after HR moves the
 * candidate on to Interview or any other stage — see this ticket's
 * explicit "preserve assessment history visibly, just like Interview
 * history" requirement.
 *
 * Uses the HISTORICAL access variant (works after Job soft-delete), same
 * as getAssessmentForCurrentStage — reading history is never blocked by
 * tenancy state that only gates new writes.
 *
 * Stage identity is read from each record's own immutable
 * stage_snapshot — frozen at creation time (see
 * ApplicationAssessment.model.ts's own doc comment), so a later HiringStep
 * rename/reorder/deletion can never change what a past assessment says it
 * was created under. A live HiringStep lookup is ONLY ever attempted for
 * legacy records that predate this field (stage_snapshot: null) — the
 * common case (every record created after this ticket) needs no live
 * lookup at all, and even the legacy fallback stays batched (one query
 * for every distinct legacy step, never one per record) rather than
 * becoming an N+1. `is_current` is still determined purely by comparing
 * hiring_step_id to the Application's current_step_id — never by
 * comparing snapshot content, which could coincidentally match an
 * unrelated stage that happens to share a name.
 *
 * At most three queries total regardless of how many historical records
 * exist: the assessment list itself, an (often skipped entirely) batched
 * lookup of legacy stages, and the existing batched latest-email-status
 * helper.
 *
 * Sorted newest-first with `_id` as a deterministic tie-break — same
 * convention as ApplicationStageTransition's own history query.
 */
export async function listAssessmentHistoryForApplication(
  companyId: string,
  applicationId: string
): Promise<AssessmentHistoryItemDTO[]> {
  const application = await getAccessibleApplication(applicationId, companyId);

  const assessments = await ApplicationAssessment.find({ application_id: applicationId }).sort({ created_at: -1, _id: -1 });
  if (assessments.length === 0) return [];

  // Only a record that predates stage_snapshot (legacy data) ever needs a
  // live lookup — deliberately never rewritten/backfilled onto the record
  // itself (see this ticket's explicit "do not rewrite history
  // automatically" instruction); this is a read-time fallback only.
  const legacyStepIds = [
    ...new Set(assessments.filter((a) => !a.stage_snapshot).map((a) => a.hiring_step_id.toString())),
  ];
  const [legacySteps, emailStatuses] = await Promise.all([
    legacyStepIds.length ? HiringStep.find({ _id: { $in: legacyStepIds } }) : Promise.resolve([]),
    batchLatestAssessmentEmailStatus(assessments.map((a) => a.id)),
  ]);
  const legacyStepById = new Map(legacySteps.map((step) => [step.id, step]));
  const currentStepId = application.current_step_id ? application.current_step_id.toString() : null;

  return assessments.map((assessment) => {
    const stage = assessment.stage_snapshot
      ? { id: assessment.stage_snapshot.id.toString(), name: assessment.stage_snapshot.name, type: assessment.stage_snapshot.type }
      : (() => {
          const legacyStep = legacyStepById.get(assessment.hiring_step_id.toString());
          return legacyStep ? { id: legacyStep.id, name: legacyStep.name, type: legacyStep.type } : null;
        })();

    return serializeAssessmentHistoryItem(
      assessment,
      stage,
      assessment.hiring_step_id.toString() === currentStepId,
      emailStatuses.get(assessment.id) ?? null
    );
  });
}

async function getOwnedAssessment(companyId: string, assessmentId: string): Promise<ApplicationAssessmentDoc> {
  const assessment = await ApplicationAssessment.findOne({ _id: assessmentId, company_id: companyId });
  if (!assessment) {
    throw new NotFoundError("Assessment not found");
  }
  return assessment;
}

/**
 * Corrects the assessment's name/external link — only while status is
 * still "pending". Once HR records passed/failed, the recorded result
 * belongs to that specific external assessment, so the name/link become
 * historical and immutable (same rationale as stage_snapshot's own
 * immutability): changing the URL afterward could make the historical
 * record misleading. Never touches status/grade/notes/sent_at/
 * result_recorded_at either way (see this ticket's explicit Part 7 "do
 * not silently overwrite result/audit fields"). Never sends an email — a
 * corrected link only ever goes out via the separate, explicit "Send
 * Again" action.
 */
export async function updateAssessmentLink(
  companyId: string,
  userId: string,
  assessmentId: string,
  input: UpdateAssessmentLinkInput
): Promise<ApplicationAssessmentDoc> {
  const assessment = await getOwnedAssessment(companyId, assessmentId);

  if (assessment.status !== "pending") {
    throw new ConflictError(LINK_LOCKED_AFTER_RESULT_MESSAGE);
  }

  if (input.name !== undefined) assessment.name = input.name;
  if (input.external_url !== undefined) assessment.external_url = input.external_url;
  assessment.updated_by_user_id = new Types.ObjectId(userId);

  await assessment.save();
  return assessment;
}

/**
 * Records/edits the HR-entered outcome — status is always an explicit HR
 * choice (never derived from grade, see this ticket's explicit Part 2/6),
 * and this NEVER touches Application.status/current_step_id: assessment
 * results are evidence only, and HR always moves/rejects a candidate
 * through the existing, separate pipeline-movement actions (see this
 * ticket's explicit Part 19/28). Never sends any email — candidate
 * result/grade/notes are internal HR workflow data, never emailed (Part
 * 20).
 */
export async function recordAssessmentResult(
  companyId: string,
  userId: string,
  assessmentId: string,
  input: RecordAssessmentResultInput
): Promise<ApplicationAssessmentDoc> {
  const assessment = await getOwnedAssessment(companyId, assessmentId);

  assessment.status = input.status;
  if (input.grade !== undefined) assessment.grade = input.grade;
  if (input.notes !== undefined) assessment.notes = input.notes;
  assessment.result_recorded_at = new Date();
  assessment.updated_by_user_id = new Types.ObjectId(userId);

  await assessment.save();
  return assessment;
}

export interface ListAssessmentsFilters {
  jobId?: string;
  status?: ApplicationAssessmentStatus;
  search?: string;
  page: number;
  limit: number;
}

export interface ListAssessmentsResult {
  assessments: AssessmentListRowDTO[];
  total: number;
}

/**
 * Company-scoped /assessments page — same batching discipline as
 * applicationHr.service.ts's listApplications: a small, FIXED number of
 * queries regardless of page size, never one lookup per row (see this
 * ticket's explicit Part 24/34#50 "list efficient/no N+1").
 */
export async function listAssessments(companyId: string, filters: ListAssessmentsFilters): Promise<ListAssessmentsResult> {
  if (filters.jobId) {
    await assertOwnedByCompany(Job, { _id: filters.jobId }, companyId, { notFoundMessage: "Job not found" });
  }

  let searchFilter: FilterQuery<ApplicationAssessmentDoc> = {};
  if (filters.search) {
    const pattern = new RegExp(escapeRegExp(filters.search), "i");
    const matchingCandidates = await Candidate.find({ $or: [{ full_name: pattern }, { email: pattern }] })
      .select("_id")
      .lean();
    const matchingApplications = matchingCandidates.length
      ? await Application.find({ candidate_id: { $in: matchingCandidates.map((c) => c._id) } })
          .select("_id")
          .lean()
      : [];
    // An empty $in correctly matches nothing (never "no filter").
    searchFilter = { $or: [{ name: pattern }, { application_id: { $in: matchingApplications.map((a) => a._id) } }] };
  }

  const filter: FilterQuery<ApplicationAssessmentDoc> = {
    company_id: companyId,
    ...(filters.jobId ? { job_id: filters.jobId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...searchFilter,
  };

  const [assessments, total] = await Promise.all([
    ApplicationAssessment.find(filter)
      .sort({ updated_at: -1 })
      .skip((filters.page - 1) * filters.limit)
      .limit(filters.limit),
    ApplicationAssessment.countDocuments(filter),
  ]);

  const applicationIds = [...new Set(assessments.map((a) => a.application_id.toString()))];
  const jobIds = [...new Set(assessments.map((a) => a.job_id.toString()))];

  const [applications, jobs, emailStatuses] = await Promise.all([
    Application.find({ _id: { $in: applicationIds } }),
    Job.find({ _id: { $in: jobIds } }),
    batchLatestAssessmentEmailStatus(assessments.map((a) => a.id)),
  ]);

  const applicationById = new Map(applications.map((a) => [a.id, a]));
  const jobById = new Map(jobs.map((j) => [j.id, j]));

  const candidateIds = [...new Set(applications.map((a) => a.candidate_id.toString()))];
  const currentStepIds = [
    ...new Set(applications.filter((a) => a.current_step_id).map((a) => a.current_step_id!.toString())),
  ];
  const [candidates, currentSteps] = await Promise.all([
    Candidate.find({ _id: { $in: candidateIds } }),
    currentStepIds.length ? HiringStep.find({ _id: { $in: currentStepIds } }) : Promise.resolve([]),
  ]);
  const candidateById = new Map(candidates.map((c) => [c.id, c]));
  const currentStepById = new Map(currentSteps.map((s) => [s.id, s]));

  const rows: AssessmentListRowDTO[] = [];
  for (const assessment of assessments) {
    const application = applicationById.get(assessment.application_id.toString());
    const job = jobById.get(assessment.job_id.toString());
    if (!application || !job) continue;
    const candidate = candidateById.get(application.candidate_id.toString());
    if (!candidate) continue;
    const currentStep = application.current_step_id ? (currentStepById.get(application.current_step_id.toString()) ?? null) : null;

    rows.push(
      serializeAssessmentListRow(
        assessment,
        candidate,
        job,
        application.status,
        currentStep,
        emailStatuses.get(assessment.id) ?? null
      )
    );
  }

  return { assessments: rows, total };
}

/**
 * Batch-resolves the current-step-scoped assessment for every given
 * Application in ONE query — used by hiringPipelineBoard.service.ts to
 * render assessment_summary without any per-card request. `pairs` is
 * already pre-filtered to only Applications currently sitting in an
 * assessment-type stage (see that caller).
 */
export async function batchAssessmentsForCurrentStage(
  pairs: { applicationId: string; hiringStepId: string }[]
): Promise<Map<string, ApplicationAssessmentDoc>> {
  const byApplication = new Map<string, ApplicationAssessmentDoc>();
  if (pairs.length === 0) return byApplication;

  const applicationIds = pairs.map((p) => new Types.ObjectId(p.applicationId));
  const stepByApplication = new Map(pairs.map((p) => [p.applicationId, p.hiringStepId]));

  const assessments = await ApplicationAssessment.find({ application_id: { $in: applicationIds } });
  for (const assessment of assessments) {
    const applicationId = assessment.application_id.toString();
    if (assessment.hiring_step_id.toString() === stepByApplication.get(applicationId)) {
      byApplication.set(applicationId, assessment);
    }
  }
  return byApplication;
}
