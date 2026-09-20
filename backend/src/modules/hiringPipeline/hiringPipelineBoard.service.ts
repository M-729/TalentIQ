import { Application, type ApplicationDoc, type ApplicationStatus } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { HiringStep } from "../../models/HiringStep.model";
import { Job, NOT_DELETED_JOB_FILTER } from "../../models/Job.model";
import { NotFoundError, PayloadTooLargeError } from "../../security/AppError";
import { assertOwnedByCompany } from "../../security/companyScope";
import { getLatestScreeningSummaries } from "../applications/applicationHr.service";
import {
  serializeBoardApplicationCard,
  serializeBoardJob,
  serializeBoardNeedsAttentionCard,
  serializeBoardStage,
  type BoardApplicationCardDTO,
  type HiringPipelineBoardDTO,
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
  await assertOwnedByCompany(Job, { _id: jobId, ...NOT_DELETED_JOB_FILTER }, companyId, {
    notFoundMessage: "Job not found",
  });
  const job = await Job.findOne({ _id: jobId, ...NOT_DELETED_JOB_FILTER });
  if (!job) {
    throw new NotFoundError("Job not found");
  }

  // The HR-configured pipeline order is canonical — never alphabetical.
  // _id is a deterministic tie-break; position has no unique index (see
  // HiringStep.model.ts) so two steps could theoretically share one.
  const steps = await HiringStep.find({ job_id: jobId }).sort({ position: 1, _id: 1 });

  const activeFilter = { job_id: jobId, status: { $in: ACTIVE_STATUSES } };
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

  function toCard(application: ApplicationDoc): BoardApplicationCardDTO | null {
    const candidate = candidateById.get(application.candidate_id.toString());
    // candidate_id is a required field and Candidates are never deleted
    // anywhere in this codebase — this should always resolve. Guarded
    // rather than asserted, matching applicationHr.service.ts's own
    // precedent: skipping a card is safer than serializing one with a
    // missing candidate.
    if (!candidate) return null;
    return serializeBoardApplicationCard(application, candidate, screeningSummaries.get(application.id));
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
