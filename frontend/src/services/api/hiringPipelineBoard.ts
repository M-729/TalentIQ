import { apiClient } from "@/services/api/client";
import type {
  BulkMoveApplicationsInput,
  BulkMoveApplicationsResult,
  HiringPipelineBoard,
  MoveApplicationHiringStepInput,
} from "@/types/hiringPipelineBoard";

// The backend returns the board DTO directly as the response body (not
// wrapped in { board: ... }) — see backend hiringPipelineBoard.controller.ts.
export function getHiringPipelineBoard(jobId: string, signal?: AbortSignal): Promise<HiringPipelineBoard> {
  return apiClient.get<HiringPipelineBoard>(`/jobs/${jobId}/hiring-pipeline`, signal);
}

export interface MoveApplicationHiringStepResult {
  application: { id: string; status: string; current_step_id: string | null };
}

// The existing transactional movement endpoint — never duplicated here.
// The frontend never invents the new status/current_step_id itself; the
// board is always refetched after a move (see useMoveApplicationHiringStep
// and MoveApplicationDialog) rather than trusting this response's shape
// for UI state.
export function moveApplicationToHiringStep(
  applicationId: string,
  input: MoveApplicationHiringStepInput
): Promise<MoveApplicationHiringStepResult> {
  return apiClient.patch<MoveApplicationHiringStepResult>(`/applications/${applicationId}/hiring-step`, input);
}

// The bulk counterpart — enforces the exact same backend business rules as
// moveApplicationToHiringStep above (see hiringPipelineBoard.service.ts's
// bulkMoveApplications), all-or-nothing. The frontend never trusts this
// response's applications[] for optimistic UI state; the board is always
// refetched after every attempt (success or failure), same rationale as
// MoveApplicationDialog's onRefetch.
export function bulkMoveApplications(
  jobId: string,
  input: BulkMoveApplicationsInput
): Promise<BulkMoveApplicationsResult> {
  return apiClient.patch<BulkMoveApplicationsResult>(`/jobs/${jobId}/hiring-pipeline/bulk-move`, input);
}
