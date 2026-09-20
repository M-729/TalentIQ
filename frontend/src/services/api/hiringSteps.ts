import { apiClient } from "@/services/api/client";
import type { CreateHiringStepInput, HiringStep, UpdateHiringStepInput } from "@/types/hiringStep";

export function getHiringSteps(jobId: string, signal?: AbortSignal): Promise<{ steps: HiringStep[] }> {
  return apiClient.get<{ steps: HiringStep[] }>(`/jobs/${jobId}/hiring-steps`, signal);
}

export function createHiringStep(jobId: string, input: CreateHiringStepInput): Promise<{ step: HiringStep }> {
  return apiClient.post<{ step: HiringStep }>(`/jobs/${jobId}/hiring-steps`, input);
}

export function updateHiringStep(
  jobId: string,
  stepId: string,
  input: UpdateHiringStepInput
): Promise<{ step: HiringStep }> {
  return apiClient.patch<{ step: HiringStep }>(`/jobs/${jobId}/hiring-steps/${stepId}`, input);
}

export function deleteHiringStep(jobId: string, stepId: string): Promise<void> {
  return apiClient.delete<void>(`/jobs/${jobId}/hiring-steps/${stepId}`);
}

// The client never computes numeric positions — it sends the full,
// reordered list of step ids, and the backend reassigns a contiguous
// 0..N-1 range from that order (see backend hiringStep.service.ts).
export function reorderHiringSteps(jobId: string, orderedStepIds: string[]): Promise<{ steps: HiringStep[] }> {
  return apiClient.patch<{ steps: HiringStep[] }>(`/jobs/${jobId}/hiring-steps/reorder`, { orderedStepIds });
}
