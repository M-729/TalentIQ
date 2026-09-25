import mongoose, { Types } from "mongoose";
import { Application, type ApplicationDoc, type ApplicationStatus } from "../../models/Application.model";
import { ApplicationStageTransition } from "../../models/ApplicationStageTransition.model";
import { Candidate } from "../../models/Candidate.model";
import { HiringStep } from "../../models/HiringStep.model";
import { Interview } from "../../models/Interview.model";
import { InterviewFeedback } from "../../models/InterviewFeedback.model";
import { Job, NOT_DELETED_JOB_FILTER, jobIdentifierFilter } from "../../models/Job.model";
import { ConflictError, NotFoundError, PayloadTooLargeError } from "../../security/AppError";
import { companyFilter } from "../../security/companyScope";
import { batchAssessmentsForCurrentStage } from "../assessments/applicationAssessment.service";
import { batchLatestAssessmentEmailStatus } from "../assessments/applicationAssessmentEmail.service";
import { getLatestScreeningSummaries } from "../applications/applicationHr.service";
import {
  CORRUPT_CURRENT_STEP_MESSAGE,
  TERMINAL_STATE_MESSAGE,
  TERMINAL_STATUSES,
  nextStatusAfterMove,
} from "../stageTransitions/stageTransition.service";
import type { BulkMoveApplicationsInput } from "./hiringPipelineBoard.validation";
import {
  serializeBoardApplicationCard,
  serializeBoardJob,
  serializeBoardNeedsAttentionCard,
  serializeBoardStage,
  type AssessmentSummaryDTO,
  type BoardApplicationCardDTO,
  type HiringPipelineBoardDTO,
  type InterviewSummaryDTO,
} from "./hiringPipelineBoard.serializer";

// Only these two statuses represent the ACTIVE hiring process this board
// visualizes. rejected/offered/hired are outcome states — deliberately
// excluded from every column, never deleted or modified by this read-only
// endpoint. A future outcome/archive view is a separate ticket.
const ACTIVE_STATUSES: ApplicationStatus[] = ["applied", "in_process"];

// Cheap safety valve against a pathological load, not real pagination —
// this first board version deliberately has none (see task report: a
// dynamic-column board makes per-column pagination substantially more
// complex, and this product is still at capstone scale). If a single Job
// ever legitimately approaches this many simultaneously active
// applications, that Job needs per-column pagination as its own ticket —
// this must never silently truncate candidates in the meantime, so it
// fails loudly with a structured 413 instead.
export const MAX_ACTIVE_APPLICATIONS_PER_BOARD = 2000;

export function assertBoardWithinCapacity(activeCount: number, limit: number = MAX_ACTIVE_APPLICATIONS_PER_BOARD): void {
  if (activeCount > limit) {
    throw new PayloadTooLargeError(
      "This job has too many active applications to display on the pipeline board right now."
    );
  }
}

/**
 * Batch-resolves a compact Interview status summary for every given
 * (applicationId, hiringStepId) pair — only ever called for cards
 * currently sitting in an interview-type HiringStep (see
 * getHiringPipelineBoard below). Two queries total regardless of how many
 * cards need one, never one Interview/InterviewFeedback lookup per card —
 * the same N+1-avoidance this module already applies via
 * getLatestScreeningSummaries.
 *
 * Deterministic "current Interview" rule (documented per this ticket's
 * requirement): an Application can accumulate more than one historical
 * Interview for the exact same HiringStep — Interview.model.ts's partial
 * unique index only blocks two SIMULTANEOUSLY "scheduled" rows for the
 * same (application, hiring_step) pair, not a fresh one scheduled after an
 * earlier one was cancelled. Rescheduling mutates the existing document in
 * place rather than creating a new one, so this only ever needs to pick
 * between such cancelled-then-rescheduled rows — the most recently
 * CREATED Interview for that exact pair is always the one shown.
 */
async function getInterviewSummaries(
  pairs: { applicationId: string; hiringStepId: string }[]
): Promise<Map<string, InterviewSummaryDTO>> {
  const summaries = new Map<string, InterviewSummaryDTO>();
  if (pairs.length === 0) return summaries;

  const applicationIds = pairs.map((pair) => pair.applicationId);
  const currentStepByApplication = new Map(pairs.map((pair) => [pair.applicationId, pair.hiringStepId]));

  const interviews = await Interview.find({ application_id: { $in: applicationIds } })
    .sort({ created_at: -1 })
    .lean();

  const currentInterviewByApplication = new Map<string, (typeof interviews)[number]>();
  for (const interview of interviews) {
    const applicationId = interview.application_id.toString();
    if (currentInterviewByApplication.has(applicationId)) continue;
    if (interview.hiring_step_id.toString() !== currentStepByApplication.get(applicationId)) continue;
    currentInterviewByApplication.set(applicationId, interview);
  }

  const completedInterviewIds = [...currentInterviewByApplication.values()]
    .filter((interview) => interview.status === "completed")
    .map((interview) => interview._id);

  const feedbackCounts = completedInterviewIds.length
    ? await InterviewFeedback.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { interview_id: { $in: completedInterviewIds }, status: "submitted" } },
        { $group: { _id: "$interview_id", count: { $sum: 1 } } },
      ])
    : [];
  const feedbackCountByInterviewId = new Map(feedbackCounts.map((row) => [row._id.toString(), row.count]));

  for (const applicationId of applicationIds) {
    const interview = currentInterviewByApplication.get(applicationId);
    if (!interview) {
      summaries.set(applicationId, { status: "not_scheduled" });
      continue;
    }
    if (interview.status === "scheduled") {
      summaries.set(applicationId, {
        status: "scheduled",
        starts_at: interview.starts_at.toISOString(),
        timezone: interview.timezone,
      });
    } else if (interview.status === "completed") {
      summaries.set(applicationId, {
        status: "completed",
        feedback_submitted_count: feedbackCountByInterviewId.get(interview._id.toString()) ?? 0,
        feedback_total_count: interview.interviewer_user_ids.length,
      });
    } else {
      summaries.set(applicationId, { status: "cancelled" });
    }
  }

  return summaries;
}

/**
 * Batch-resolves a compact Assessment status summary for every given
 * (applicationId, hiringStepId) pair — only ever called for cards
 * currently sitting in an assessment-type HiringStep. Two queries total
 * regardless of how many cards need one, never one ApplicationAssessment/
 * EmailNotification lookup per card — reuses
 * applicationAssessment.service.ts's own batching helper (the exact same
 * "current-stage-scoped assessment" resolution the Application Detail
 * page's GET uses for one Application) plus
 * applicationAssessmentEmail.service.ts's batched latest-notification-
 * status helper, mirroring getInterviewSummaries's own two-query shape
 * exactly.
 */
async function getAssessmentSummaries(
  pairs: { applicationId: string; hiringStepId: string }[]
): Promise<Map<string, AssessmentSummaryDTO>> {
  const summaries = new Map<string, AssessmentSummaryDTO>();
  if (pairs.length === 0) return summaries;

  const assessmentByApplication = await batchAssessmentsForCurrentStage(pairs);
  const emailStatuses = await batchLatestAssessmentEmailStatus([...assessmentByApplication.values()].map((a) => a.id));

  for (const pair of pairs) {
    const assessment = assessmentByApplication.get(pair.applicationId);
    if (!assessment) {
      summaries.set(pair.applicationId, { status: "not_configured", grade: null, email_status: null });
      continue;
    }
    summaries.set(pair.applicationId, {
      status: assessment.status,
      grade: assessment.grade ?? null,
      email_status: emailStatuses.get(assessment.id) ?? null,
    });
  }

  return summaries;
}

/**
 * Read-only recruiter board for one Job's active hiring pipeline.
 *
 * This is an ACTIVE recruiter workflow endpoint — a soft-deleted Job is
 * unavailable here (404), matching hiringStep.service.ts's own
 * NOT_DELETED_JOB_FILTER-gated checks. A closed (but not deleted) Job is
 * deliberately still readable: `status: "closed"` means the recruitment
 * process stopped accepting new candidates, not that historical board
 * review is blocked — closed != deleted (see Job.model.ts). No write of
 * any kind happens anywhere in this function: no Application is moved, no
 * status changes, no history is created, no AI/R2/email call is made.
 */
export async function getHiringPipelineBoard(companyId: string, jobId: string): Promise<HiringPipelineBoardDTO> {
  // jobId is the Job's public_id path segment (public-id only since the
  // Phase 2 cutover — see job.validation.ts's jobIdentifierString) —
  // resolving it directly via
  // Job.findOne (rather than a separate assertOwnedByCompany + a second
  // lookup) gives the real internal id every HiringStep/Application
  // job_id query below actually needs, in one query.
  const job = await Job.findOne({ ...jobIdentifierFilter(jobId), ...companyFilter(companyId), ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError("Job not found");
  }
  const resolvedJobId = job.id;

  // The HR-configured pipeline order is canonical — never alphabetical.
  // _id is a deterministic tie-break; position has no unique index (see
  // HiringStep.model.ts) so two steps could theoretically share one.
  const steps = await HiringStep.find({ job_id: resolvedJobId }).sort({ position: 1, _id: 1 });

  const activeFilter = { job_id: resolvedJobId, status: { $in: ACTIVE_STATUSES } };
  const activeCount = await Application.countDocuments(activeFilter);
  assertBoardWithinCapacity(activeCount);

  // Oldest-waiting-first (applied_at ASC), not this codebase's usual
  // newest-first list convention (see applicationHr.service.ts's
  // `applied_at: -1`) — deliberate for this endpoint specifically: a
  // recruiter board's whole purpose is surfacing who has been waiting
  // longest in each column, not "what just came in". _id is a
  // deterministic tie-break for applications sharing a timestamp.
  const activeApplications = await Application.find(activeFilter).sort({ applied_at: 1, _id: 1 });

  const candidateIds = [...new Set(activeApplications.map((application) => application.candidate_id.toString()))];
  const applicationIds = activeApplications.map((application) => application.id);

  // Two batched queries (never one per row) — the exact same
  // N+1-avoidance pattern applicationHr.service.ts's listApplications
  // already established, reused here rather than duplicated.
  const [candidates, screeningSummaries] = await Promise.all([
    Candidate.find({ _id: { $in: candidateIds } }),
    getLatestScreeningSummaries(applicationIds),
  ]);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));

  const stepIds = new Set(steps.map((step) => step.id));

  const unassigned: ApplicationDoc[] = [];
  const byStepId = new Map<string, ApplicationDoc[]>();
  const needsAttention: ApplicationDoc[] = [];

  // Strict invariant classification — every active Application must land
  // in exactly one bucket. Anything that doesn't cleanly satisfy either
  // "unassigned" or "a real stage of this Job" (in_process pointing
  // nowhere, applied with a stage already set, or current_step_id
  // pointing at another Job's stage / a dangling id) is never silently
  // placed into a misleading column — it goes to needs_attention instead,
  // a clearly named, safe, visible list rather than a hidden or
  // board-breaking failure (see task report for why this was chosen over
  // failing the whole board).
  for (const application of activeApplications) {
    const currentStepId = application.current_step_id ? application.current_step_id.toString() : null;

    if (application.status === "applied" && currentStepId === null) {
      unassigned.push(application);
    } else if (application.status === "in_process" && currentStepId !== null && stepIds.has(currentStepId)) {
      const bucket = byStepId.get(currentStepId) ?? [];
      bucket.push(application);
      byStepId.set(currentStepId, bucket);
    } else {
      needsAttention.push(application);
    }
  }

  // Only ever resolved for a card currently sitting in an interview-type
  // stage (see Parts 18-21) — New Applicants and every non-interview stage
  // never need one, so their pairs are simply never built.
  const interviewStepIds = new Set(steps.filter((step) => step.type === "interview").map((step) => step.id));
  const interviewPairs: { applicationId: string; hiringStepId: string }[] = [];
  for (const [stepId, apps] of byStepId) {
    if (!interviewStepIds.has(stepId)) continue;
    for (const application of apps) {
      interviewPairs.push({ applicationId: application.id, hiringStepId: stepId });
    }
  }
  const interviewSummaries = await getInterviewSummaries(interviewPairs);

  // Same shape as interviewPairs above, scoped to assessment-type steps.
  const assessmentStepIds = new Set(steps.filter((step) => step.type === "assessment").map((step) => step.id));
  const assessmentPairs: { applicationId: string; hiringStepId: string }[] = [];
  for (const [stepId, apps] of byStepId) {
    if (!assessmentStepIds.has(stepId)) continue;
    for (const application of apps) {
      assessmentPairs.push({ applicationId: application.id, hiringStepId: stepId });
    }
  }
  const assessmentSummaries = await getAssessmentSummaries(assessmentPairs);

  function toCard(application: ApplicationDoc): BoardApplicationCardDTO | null {
    const candidate = candidateById.get(application.candidate_id.toString());
    // candidate_id is a required field and Candidates are never deleted
    // anywhere in this codebase — this should always resolve. Guarded
    // rather than asserted, matching applicationHr.service.ts's own
    // precedent: skipping a card is safer than serializing one with a
    // missing candidate.
    if (!candidate) return null;
    return serializeBoardApplicationCard(
      application,
      candidate,
      screeningSummaries.get(application.id),
      interviewSummaries.get(application.id) ?? null,
      assessmentSummaries.get(application.id) ?? null
    );
  }

  return {
    job: serializeBoardJob(job),
    unassigned: {
      count: unassigned.length,
      applications: unassigned.map(toCard).filter((card): card is BoardApplicationCardDTO => card !== null),
    },
    stages: steps.map((step) =>
      serializeBoardStage(
        step,
        (byStepId.get(step.id) ?? []).map(toCard).filter((card): card is BoardApplicationCardDTO => card !== null)
      )
    ),
    needs_attention: needsAttention
      .map((application) => {
        const candidate = candidateById.get(application.candidate_id.toString());
        if (!candidate) return null;
        return serializeBoardNeedsAttentionCard(application, candidate, screeningSummaries.get(application.id));
      })
      .filter((card): card is ReturnType<typeof serializeBoardNeedsAttentionCard> => card !== null),
  };
}

const ALREADY_IN_TARGET_MESSAGE = "One or more selected candidates are already in the destination stage.";
const CONCURRENT_BULK_MOVE_MESSAGE = "One or more selected applications changed. Refresh the pipeline and try again.";

export interface BulkMoveApplicationsResult {
  moved_count: number;
  target_step: { id: string; name: string; type: string };
  applications: { id: string; status: ApplicationStatus; current_step_id: string }[];
}

interface BulkMovePlan {
  application: ApplicationDoc;
  fromStepSnapshot: { name: string; type: string } | null;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
}

/**
 * Bulk pipeline-stage movement — the multi-candidate counterpart to
 * stageTransition.service.ts's moveApplicationStage, sharing its exact
 * terminal/already-in-stage/corrupt-step business rules (imported, never
 * re-typed) so the two paths can never drift apart. Like the single-move
 * path, this ONLY changes Application.current_step_id/status and writes
 * append-only ApplicationStageTransition history — it never creates an
 * Interview, schedules a time, calls Google Calendar/Meet, sends an email,
 * creates an Assessment, or runs AI screening. Moving a batch of
 * candidates into an interview- or assessment-type stage is exactly as
 * inert here as moving one candidate already is via moveApplicationStage.
 *
 * All-or-nothing: every selected Application is validated up front, then
 * every write (the Application updates AND every candidate's own
 * transition record) happens inside a single Mongo transaction. A single
 * bulkWrite (not one findOneAndUpdate per candidate) guards each
 * Application's update with the EXACT (current_step_id, status) observed
 * moments before the transaction — the same optimistic-concurrency pattern
 * moveApplicationStage uses for one document, extended here to N documents
 * in one round trip. If any single candidate's guard fails to match (state
 * changed since the board was read), modifiedCount comes back short and
 * the whole transaction is aborted — never a partial move.
 */
export async function bulkMoveApplications(
  companyId: string,
  userId: string,
  jobId: string,
  input: BulkMoveApplicationsInput
): Promise<BulkMoveApplicationsResult> {
  // Same active-Job gate as single movement (getAccessibleApplicationForActiveJob):
  // a soft-deleted Job's pipeline is unavailable for movement; a merely
  // closed Job still permits moving its existing applicants. jobId is the
  // Job's public_id path segment (public-id only since the Phase 2
  // cutover) — resolved to the real internal id here, since every query
  // below is against a plain ObjectId job_id FK that was never itself
  // migrated.
  const job = await Job.findOne({ ...jobIdentifierFilter(jobId), ...companyFilter(companyId), ...NOT_DELETED_JOB_FILTER }).select(
    "_id"
  );
  if (!job) {
    throw new NotFoundError("Job not found");
  }
  const resolvedJobId = job.id;

  const targetStep = await HiringStep.findOne({ _id: input.target_hiring_step_id, job_id: resolvedJobId });
  if (!targetStep) {
    throw new NotFoundError("Hiring stage not found");
  }

  const objectIds = input.application_ids.map((id) => new Types.ObjectId(id));
  const applications = await Application.find({ _id: { $in: objectIds }, job_id: resolvedJobId });

  // Every selected id must resolve to an Application belonging to THIS
  // Job — a missing id (nonexistent, another Job, another company) fails
  // the whole request rather than silently moving a partial set.
  if (applications.length !== input.application_ids.length) {
    throw new NotFoundError("One or more selected applications were not found");
  }
  const applicationById = new Map(applications.map((application) => [application.id, application]));

  // Batch-resolve every distinct current stage referenced by the selection
  // in one query (never one HiringStep lookup per candidate) — the same
  // N+1-avoidance this module already applies to Candidate/screening reads.
  const currentStepIds = [
    ...new Set(applications.filter((a) => a.current_step_id).map((a) => a.current_step_id!.toString())),
  ];
  const currentSteps = currentStepIds.length
    ? await HiringStep.find({ _id: { $in: currentStepIds }, job_id: resolvedJobId })
    : [];
  const currentStepById = new Map(currentSteps.map((step) => [step.id, step]));

  const plans: BulkMovePlan[] = [];
  for (const applicationId of input.application_ids) {
    const application = applicationById.get(applicationId)!;

    if (TERMINAL_STATUSES.has(application.status)) {
      throw new ConflictError(TERMINAL_STATE_MESSAGE);
    }

    const observedCurrentStepId = application.current_step_id ? application.current_step_id.toString() : null;
    if (observedCurrentStepId === input.target_hiring_step_id) {
      throw new ConflictError(ALREADY_IN_TARGET_MESSAGE);
    }

    let fromStepSnapshot: { name: string; type: string } | null = null;
    if (application.current_step_id) {
      const fromStep = currentStepById.get(application.current_step_id.toString());
      if (!fromStep) {
        throw new ConflictError(CORRUPT_CURRENT_STEP_MESSAGE);
      }
      fromStepSnapshot = { name: fromStep.name, type: fromStep.type };
    }

    const fromStatus = application.status;
    const toStatus = nextStatusAfterMove(fromStatus);
    plans.push({ application, fromStepSnapshot, fromStatus, toStatus });
  }

  const session = await mongoose.startSession();
  try {
    let result: BulkMoveApplicationsResult | undefined;

    await session.withTransaction(async () => {
      // Goes through the underlying native MongoDB driver collection
      // (same collection/data, not a different write path) rather than
      // Application.bulkWrite() — Mongoose's InferSchemaType produces a
      // broad `[x: string]: NativeDate` index signature for this schema
      // that makes the Model-level bulkWrite's generic typing reject a
      // plain `{ $set: { current_step_id, status } }` update; see
      // hiringStep.service.ts's reorderHiringSteps for the exact same
      // precedent/workaround.
      const writeResult = await Application.collection.bulkWrite(
        plans.map((plan) => ({
          updateOne: {
            filter: {
              _id: plan.application._id,
              current_step_id: plan.application.current_step_id,
              status: plan.fromStatus,
            },
            update: { $set: { current_step_id: targetStep._id, status: plan.toStatus } },
          },
        })),
        { session }
      );

      // Any candidate whose guard filter matched nothing means their state
      // changed since the board was read — abort the ENTIRE batch rather
      // than committing a partial move (see doc comment above).
      if (writeResult.modifiedCount !== plans.length) {
        throw new ConflictError(CONCURRENT_BULK_MOVE_MESSAGE);
      }

      // One append-only transition document per candidate — never a single
      // generic record for the whole batch (see Part 6 of the task).
      await ApplicationStageTransition.insertMany(
        plans.map((plan) => ({
          application_id: plan.application._id,
          job_id: plan.application.job_id,
          from_step_id: plan.application.current_step_id,
          to_step_id: targetStep._id,
          from_step_snapshot: plan.fromStepSnapshot,
          to_step_snapshot: { name: targetStep.name, type: targetStep.type },
          from_status: plan.fromStatus,
          to_status: plan.toStatus,
          moved_by: userId,
        })),
        { session }
      );

      result = {
        moved_count: plans.length,
        target_step: { id: targetStep.id, name: targetStep.name, type: targetStep.type },
        applications: plans.map((plan) => ({
          id: plan.application.id,
          status: plan.toStatus,
          current_step_id: targetStep.id,
        })),
      };
    });

    // withTransaction only resolves without throwing once the transaction
    // has committed, so `result` is always set here.
    return result!;
  } finally {
    await session.endSession();
  }
}
