import { Interview, type InterviewDoc } from "../../models/Interview.model";
import { HiringStep } from "../../models/HiringStep.model";
import { User } from "../../models/User.model";
import { BadRequestError, ConflictError, NotFoundError } from "../../security/AppError";
import { isDuplicateKeyError } from "../../middleware/error.middleware";
import {
  getAccessibleApplication,
  getAccessibleApplicationForActiveJob,
} from "../applications/applicationAccess.service";
import { getAccessibleInterview, getAccessibleInterviewForActiveJob } from "./interviewAccess.service";
import type { UserRef } from "./interview.serializer";
import type { CancelInterviewInput, RescheduleInterviewInput, ScheduleInterviewInput } from "./interview.validation";

const NOT_INTERVIEW_STAGE_MESSAGE = "This application is not currently in an interview stage.";
const CORRUPT_CURRENT_STEP_MESSAGE = "This application's current hiring stage could not be resolved consistently.";
const DUPLICATE_ACTIVE_INTERVIEW_MESSAGE =
  "An interview is already scheduled for this application at this stage. Use reschedule instead.";
const INVALID_INTERVIEWERS_MESSAGE = "One or more selected interviewers are not available.";
const NOT_RESCHEDULABLE_MESSAGE = "This interview cannot be rescheduled because it is not currently scheduled.";
const NOT_CANCELLABLE_MESSAGE = "This interview cannot be cancelled because it is not currently scheduled.";
const CONCURRENT_CHANGE_MESSAGE = "This interview was just changed by someone else. Please refresh and try again.";

/**
 * Validates that every id in `interviewerUserIds` resolves to a real User
 * belonging to `companyId`, in ONE batched query — never one lookup per
 * id. Returns the deduplicated id list (see scheduleInterview/
 * rescheduleInterview: duplicate interviewer ids are normalized away
 * rather than rejected as a validation error, since a client
 * accidentally submitting the same id twice isn't meaningfully different
 * from submitting it once). Throws a single generic 400 if ANY id
 * doesn't resolve — never which one(s) or why, so this can't be used to
 * probe whether a specific user id exists in another company.
 */
async function assertValidInterviewers(interviewerUserIds: string[], companyId: string): Promise<string[]> {
  const uniqueIds = [...new Set(interviewerUserIds)];
  const matchCount = await User.countDocuments({ _id: { $in: uniqueIds }, company_id: companyId });
  if (matchCount !== uniqueIds.length) {
    throw new BadRequestError(INVALID_INTERVIEWERS_MESSAGE);
  }
  return uniqueIds;
}

/**
 * Schedules a NEW Interview for an Application currently sitting in an
 * interview-type HiringStep — always an explicit HR/Admin action (see
 * interview.routes.ts's requireRole("HR", "ADMIN")). Moving an
 * Application into an interview stage never reaches this function on its
 * own (see stageTransition.service.ts — completely unrelated code path);
 * nothing here calls AI, Google, or email.
 *
 * Eligibility is one unified check — status must be "in_process" AND
 * current_step_id must be set AND that step's type must be "interview" —
 * deliberately not broken into separate "terminal status" vs "wrong
 * stage type" branches with different messages: rejected/offered/hired
 * Applications already fail the status half of this same condition, so
 * one safe message ("not currently in an interview stage") correctly
 * covers every case the ticket calls out (terminal status, unassigned,
 * review/assessment/other stage type) without revealing which specific
 * condition failed.
 *
 * Concurrency: relies on Interview.model.ts's partial unique index
 * ({application_id, hiring_step_id}, unique when status: "scheduled")
 * rather than a transaction — scheduling only ever creates ONE document,
 * so there's no multi-document atomicity requirement a transaction would
 * solve; the pre-check below is only a fast, friendly reject for the
 * common (non-race) case, and the duplicate-key catch is what actually
 * guarantees correctness under real concurrency.
 */
export async function scheduleInterview(
  companyId: string,
  userId: string,
  applicationId: string,
  input: ScheduleInterviewInput
): Promise<InterviewDoc> {
  const application = await getAccessibleApplicationForActiveJob(applicationId, companyId);

  if (application.status !== "in_process" || !application.current_step_id) {
    throw new ConflictError(NOT_INTERVIEW_STAGE_MESSAGE);
  }

  const currentStep = await HiringStep.findOne({ _id: application.current_step_id, job_id: application.job_id });
  if (!currentStep) {
    // current_step_id is set but doesn't resolve to a real stage of this
    // Job — corrupted/legacy pipeline state, not a normal case. Fail
    // safely rather than inventing a fake snapshot (same policy as
    // stageTransition.service.ts's own corrupt-current-step handling).
    throw new ConflictError(CORRUPT_CURRENT_STEP_MESSAGE);
  }
  if (currentStep.type !== "interview") {
    throw new ConflictError(NOT_INTERVIEW_STAGE_MESSAGE);
  }

  const alreadyScheduled = await Interview.exists({
    application_id: applicationId,
    hiring_step_id: currentStep._id,
    status: "scheduled",
  });
  if (alreadyScheduled) {
    throw new ConflictError(DUPLICATE_ACTIVE_INTERVIEW_MESSAGE);
  }

  const interviewerUserIds = await assertValidInterviewers(input.interviewer_user_ids, companyId);

  // Falls back to the current HiringStep's own name — never a fake/AI
  // string, and never re-derived after scheduling (the snapshot below is
  // what's stored, not the live name).
  const title = input.title?.trim() || currentStep.name;

  try {
    return await Interview.create({
      application_id: application.id,
      job_id: application.job_id,
      hiring_step_id: currentStep.id,
      stage_snapshot: { name: currentStep.name, type: currentStep.type },
      title,
      starts_at: new Date(input.starts_at),
      ends_at: new Date(input.ends_at),
      timezone: input.timezone,
      interviewer_user_ids: interviewerUserIds,
      status: "scheduled",
      scheduled_by: userId,
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) {
      throw new ConflictError(DUPLICATE_ACTIVE_INTERVIEW_MESSAGE);
    }
    throw err;
  }
}

/**
 * Read-only: never modifies anything, never calls AI/R2/Google. Uses the
 * HISTORICAL access variant (allows a soft-deleted Job) — a Job being
 * administratively removed from active workflow must never make its past
 * Interviews unreadable; this is business/audit data.
 *
 * starts_at DESC is served directly by Interview.model.ts's
 * { application_id: 1, starts_at: -1 } index (no in-memory sort); _id
 * DESC is a deterministic tie-break for Interviews sharing a starts_at
 * timestamp exactly.
 */
export async function listInterviewsForApplication(
  applicationId: string,
  companyId: string
): Promise<{ interviews: InterviewDoc[]; userMap: Map<string, UserRef> }> {
  await getAccessibleApplication(applicationId, companyId);

  const interviews = await Interview.find({ application_id: applicationId }).sort({ starts_at: -1, _id: -1 });
  const userMap = await batchUserLookup(interviews);

  return { interviews, userMap };
}

export async function getInterviewDetail(
  interviewId: string,
  companyId: string
): Promise<{ interview: InterviewDoc; userMap: Map<string, UserRef> }> {
  const interview = await getAccessibleInterview(interviewId, companyId);
  const userMap = await batchUserLookup([interview]);

  return { interview, userMap };
}

/**
 * Interview.status must still be "scheduled" both at the initial read AND
 * at write time — the guarded findOneAndUpdate below is what actually
 * enforces the latter, protecting against a reschedule racing a
 * concurrent cancel: if cancel commits first, this update's
 * { status: "scheduled" } filter matches nothing and the caller gets a
 * clean 409 instead of silently resurrecting/overwriting a cancelled
 * Interview. stage_snapshot is never touched here — reschedule changes
 * timing/interviewers only.
 */
export async function rescheduleInterview(
  companyId: string,
  interviewId: string,
  input: RescheduleInterviewInput
): Promise<InterviewDoc> {
  const interview = await getAccessibleInterviewForActiveJob(interviewId, companyId);

  if (interview.status !== "scheduled") {
    throw new ConflictError(NOT_RESCHEDULABLE_MESSAGE);
  }

  const update: Record<string, unknown> = {
    starts_at: new Date(input.starts_at),
    ends_at: new Date(input.ends_at),
    timezone: input.timezone,
  };
  if (input.interviewer_user_ids) {
    update.interviewer_user_ids = await assertValidInterviewers(input.interviewer_user_ids, companyId);
  }

  const updated = await Interview.findOneAndUpdate(
    { _id: interviewId, status: "scheduled" },
    { $set: update },
    { new: true }
  );
  if (!updated) {
    throw new ConflictError(CONCURRENT_CHANGE_MESSAGE);
  }
  return updated;
}

/**
 * Cancellation uses the HISTORICAL access variant (not the active-Job
 * one) — deliberately: if a Job is soft-deleted while a real meeting is
 * still scheduled, administrative deletion must not strand an obsolete
 * scheduled Interview with no way to clean it up. Cancellation is
 * cleanup, not progression through the active pipeline, so it stays
 * available even after the Job is gone from normal workflow.
 *
 * Same guarded-update concurrency pattern as reschedule: only a
 * currently-"scheduled" Interview can transition to "cancelled", so two
 * competing cancel/reschedule requests can't silently overwrite each
 * other's outcome.
 */
export async function cancelInterview(
  companyId: string,
  userId: string,
  interviewId: string,
  input: CancelInterviewInput
): Promise<InterviewDoc> {
  const interview = await getAccessibleInterview(interviewId, companyId);

  if (interview.status !== "scheduled") {
    throw new ConflictError(NOT_CANCELLABLE_MESSAGE);
  }

  const updated = await Interview.findOneAndUpdate(
    { _id: interviewId, status: "scheduled" },
    {
      $set: {
        status: "cancelled",
        cancelled_at: new Date(),
        cancelled_by: userId,
        cancellation_reason: input.reason ?? null,
      },
    },
    { new: true }
  );
  if (!updated) {
    throw new ConflictError(NOT_CANCELLABLE_MESSAGE);
  }
  return updated;
}

/**
 * Batches every User id referenced across the given Interviews
 * (interviewers + scheduled_by + cancelled_by, deduplicated) into ONE
 * query — never one lookup per Interview or per interviewer. Fetches
 * name+email for all of them regardless of role, since interviewers need
 * email in the DTO anyway (see interview.serializer.ts) and the marginal
 * cost of having it available for scheduled_by/cancelled_by too is
 * negligible; the serializer simply doesn't use it for those two roles.
 */
export async function batchUserLookup(interviews: InterviewDoc[]): Promise<Map<string, UserRef>> {
  const ids = new Set<string>();
  for (const interview of interviews) {
    for (const interviewerId of interview.interviewer_user_ids) {
      ids.add(interviewerId.toString());
    }
    ids.add(interview.scheduled_by.toString());
    if (interview.cancelled_by) {
      ids.add(interview.cancelled_by.toString());
    }
  }

  if (ids.size === 0) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: [...ids] } }).select("name email");
  return new Map(users.map((user) => [user.id, { id: user.id, name: user.name, email: user.email }]));
}
