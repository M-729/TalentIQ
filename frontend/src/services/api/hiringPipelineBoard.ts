import { apiClient } from "@/services/api/client";
import type { HiringPipelineBoard, MoveApplicationHiringStepInput } from "@/types/hiringPipelineBoard";

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
