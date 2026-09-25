import { Interview, interviewIdentifierFilter, type InterviewDoc } from "../../models/Interview.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany } from "../../security/companyScope";

/**
 * Resolves an Interview and verifies it belongs — via its denormalized
 * job_id — to the given company. The one place tenant-resolution logic
 * for Interview-scoped routes lives, mirroring
 * applicationAccess.service.ts's getAccessibleApplication exactly.
 *
 * Denies as 404 for a nonexistent Interview and for one belonging to a
 * different company alike — never distinguishable, same as every other
 * tenant-scoped resource in this codebase.
 *
 * This is the HISTORICAL variant: it does NOT gate on the Job still
 * being active. Reading an Interview (detail/list) and cancelling one
 * must both keep working after the Job is later soft-deleted — see
 * interview.service.ts's cancelInterview doc comment for why
 * cancellation specifically is allowed here rather than through the
 * active-Job variant below.
 */
export async function getAccessibleInterview(interviewId: string, companyId: string): Promise<InterviewDoc> {
  const interview = await Interview.findOne(interviewIdentifierFilter(interviewId));
  if (!interview) {
    throw new NotFoundError("Interview not found");
  }

  await assertOwnedByCompany(Job, { _id: interview.job_id }, companyId, { notFoundMessage: "Interview not found" });

  return interview;
}

/**
 * Same tenant-resolution semantics, plus one extra gate: the Interview's
 * Job must NOT be soft-deleted. Use this for any ACTIVE interview
 * operation — currently, rescheduling. Scheduling a brand-new Interview
 * resolves its active-Job gate through
 * applicationAccess.service.ts's getAccessibleApplicationForActiveJob
 * instead, since scheduling starts from an applicationId, not an
 * existing Interview.
 *
 * Denies as 404 ("Job not found") for a soft-deleted Job, matching every
 * other active-pipeline-operation gate in this codebase
 * (hiringStep.service.ts, stageTransition.service.ts,
 * screening.service.ts's createScreening).
 */
export async function getAccessibleInterviewForActiveJob(interviewId: string, companyId: string): Promise<InterviewDoc> {
  const interview = await Interview.findOne(interviewIdentifierFilter(interviewId));
  if (!interview) {
    throw new NotFoundError("Interview not found");
  }

  await assertOwnedByCompany(Job, { _id: interview.job_id, ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });

  return interview;
}
