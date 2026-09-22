import mongoose from "mongoose";
import { Application, type ApplicationDoc, type ApplicationStatus } from "../../models/Application.model";
import { ApplicationStageTransition, type ApplicationStageTransitionDoc } from "../../models/ApplicationStageTransition.model";
import { HiringStep } from "../../models/HiringStep.model";
import { User } from "../../models/User.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { getAccessibleApplication, getAccessibleApplicationForActiveJob } from "../applications/applicationAccess.service";
import type { MoveApplicationStageInput } from "./stageTransition.validation";

// Exported so hiringPipelineBoard.service.ts's bulk-move path enforces the
// EXACT same terminal/already-in-stage/corrupt-step business rules as this
// single-move path, rather than a re-typed copy that could silently drift.
export const TERMINAL_STATUSES: ReadonlySet<ApplicationStatus> = new Set(["rejected", "offered", "hired"]);

export const ALREADY_IN_STAGE_MESSAGE = "The application is already in this hiring stage.";
export const TERMINAL_STATE_MESSAGE =
  "This application cannot be moved through the active hiring pipeline in its current status.";
const CONCURRENT_MOVE_MESSAGE = "This application was just moved by someone else. Please refresh and try again.";
export const CORRUPT_CURRENT_STEP_MESSAGE =
  "This application's current hiring stage could not be resolved consistently.";

// The one piece of status-transition logic a drift between single-move and
// bulk-move would be easiest to get subtly wrong: "applied" is the only
// non-terminal status this ever sees that isn't already "in_process"
// (terminal statuses are rejected before this runs) — initial assignment
// moves it forward; every subsequent move simply keeps it at "in_process".
export function nextStatusAfterMove(fromStatus: ApplicationStatus): ApplicationStatus {
  return fromStatus === "applied" ? "in_process" : fromStatus;
}

export interface MoveApplicationStageResult {
  application: ApplicationDoc;
  transition: ApplicationStageTransitionDoc;
  movedByName: string;
}

/**
 * Moves an Application into a HiringStep — always an explicit HR/Admin
 * action (see stageTransition.routes.ts's requireRole("HR", "ADMIN")).
 * Nothing here calls AI, Groq, CV extraction, R2, or email — movement is
 * pure pipeline/workflow bookkeeping.
 *
 * Two business facts change together — Application.current_step_id/status,
 * and a new immutable transition history event — and they must succeed or
 * fail together. This runs inside a real MongoDB multi-document
 * transaction (see tests/setup.ts for why the test environment now runs a
 * single-node replica set rather than a standalone instance: transactions
 * require one, and this codebase's production target, MongoDB Atlas, is
 * always already a replica set, so this was purely a test-infrastructure
 * gap, not a production feasibility question).
 *
 * Concurrency: the Application update is a single conditional
 * findOneAndUpdate guarded by the exact (current_step_id, status) this
 * function observed before the transaction — MongoDB's own single-document
 * atomicity means that guard can never spuriously pass. If another
 * request already moved the same Application in the meantime, the guard
 * simply matches nothing, and this throws a safe 409 inside the
 * transaction (which aborts it — no orphaned transition is ever left
 * behind). No distributed locking is built; optimistic concurrency via
 * this guard is sufficient because losing the race is safe (a clean
 * conflict, not a silent overwrite or a corrupted audit trail) and stage
 * movement is a low-frequency, human-triggered action.
 */
export async function moveApplicationStage(
  companyId: string,
  userId: string,
  applicationId: string,
  input: MoveApplicationStageInput
): Promise<MoveApplicationStageResult> {
  // Tenant check + "is this Job still active" gate, before any other
  // read — a soft-deleted Job's pipeline is unavailable for movement
  // (404), even though the Application itself may still be viewed
  // elsewhere (see getAccessibleApplicationForActiveJob's doc comment).
  const application = await getAccessibleApplicationForActiveJob(applicationId, companyId);

  if (TERMINAL_STATUSES.has(application.status)) {
    throw new ConflictError(TERMINAL_STATE_MESSAGE);
  }

  const observedCurrentStepId = application.current_step_id ? application.current_step_id.toString() : null;
  if (observedCurrentStepId === input.step_id) {
    throw new ConflictError(ALREADY_IN_STAGE_MESSAGE);
  }

  // Target stage must exist AND belong to this exact Job — a stage from
  // a different Job (even one in the same company) is never accepted;
  // scoping the query by job_id makes that structurally impossible rather
  // than checking it after the fact.
  const targetStep = await HiringStep.findOne({ _id: input.step_id, job_id: application.job_id });
  if (!targetStep) {
    throw new NotFoundError("Hiring stage not found");
  }

  // Resolve the FROM snapshot from the live HiringStep now (this becomes
  // a permanent, never-re-resolved record of what the stage was called at
  // move time — see ApplicationStageTransition.model.ts). If
  // current_step_id is set but doesn't resolve to a real stage on this
  // Job, that is corrupted pipeline state, not a normal "unassigned"
  // case — fail safely rather than inventing a fake snapshot or silently
  // clearing it.
  let fromStepSnapshot: { name: string; type: string } | null = null;
  if (application.current_step_id) {
    const fromStep = await HiringStep.findOne({ _id: application.current_step_id, job_id: application.job_id });
    if (!fromStep) {
      throw new ConflictError(CORRUPT_CURRENT_STEP_MESSAGE);
    }
    fromStepSnapshot = { name: fromStep.name, type: fromStep.type };
  }

  const fromStatus = application.status;
  const toStatus: ApplicationStatus = nextStatusAfterMove(fromStatus);

  // requireAuth already confirmed this user exists and is active moments
  // before this call — a plain read, not part of the guarded/transactional
  // write below.
  const mover = await User.findById(userId).select("name");
  const movedByName = mover?.name ?? "Unknown";

  const session = await mongoose.startSession();
  try {
    let result: MoveApplicationStageResult | undefined;

    await session.withTransaction(async () => {
      const updatedApplication = await Application.findOneAndUpdate(
        { _id: applicationId, current_step_id: application.current_step_id, status: fromStatus },
        { $set: { current_step_id: targetStep._id, status: toStatus } },
        { new: true, session }
      );

      if (!updatedApplication) {
        throw new ConflictError(CONCURRENT_MOVE_MESSAGE);
      }

      const [transition] = await ApplicationStageTransition.create(
        [
          {
            application_id: updatedApplication._id,
            job_id: application.job_id,
            from_step_id: application.current_step_id,
            to_step_id: targetStep._id,
            from_step_snapshot: fromStepSnapshot,
            to_step_snapshot: { name: targetStep.name, type: targetStep.type },
            from_status: fromStatus,
            to_status: toStatus,
            moved_by: userId,
            note: input.note,
          },
        ],
        { session }
      );

      result = { application: updatedApplication, transition: transition!, movedByName };
    });

    // withTransaction only resolves without throwing once the transaction
    // has committed, so `result` is always set here.
    return result!;
  } finally {
    await session.endSession();
  }
}

/**
 * Read-only stage history for an Application — never modifies anything,
 * never recalculates anything, never calls AI or R2. Uses
 * getAccessibleApplication (NOT the active-Job variant above) so history
 * for an Application whose Job was later soft-deleted stays readable,
 * same as AI screening history already does.
 *
 * Newest-first (created_at DESC, _id DESC as a deterministic tie-break —
 * see ApplicationStageTransition.model.ts's index comment), matching this
 * codebase's existing screening-history API convention.
 */
export async function getStageHistory(
  applicationId: string,
  companyId: string
): Promise<{ transitions: ApplicationStageTransitionDoc[]; movedByNames: Map<string, string> }> {
  await getAccessibleApplication(applicationId, companyId);

  const transitions = await ApplicationStageTransition.find({ application_id: applicationId }).sort({
    created_at: -1,
    _id: -1,
  });

  const userIds = [...new Set(transitions.map((transition) => transition.moved_by.toString()))];
  const users = await User.find({ _id: { $in: userIds } }).select("name");
  const movedByNames = new Map(users.map((user) => [user.id, user.name]));

  return { transitions, movedByNames };
}
