import { apiClient } from "@/services/api/client";
import type { ApplicationDetail } from "@/types/application";
import type { RejectApplicationInput, RejectionInfo, RejectionNotification } from "@/types/rejection";

export function rejectApplication(
  applicationId: string,
  input: RejectApplicationInput
): Promise<{ application: ApplicationDetail; notification: RejectionNotification | null }> {
  return apiClient.post<{ application: ApplicationDetail; notification: RejectionNotification | null }>(
    `/applications/${applicationId}/reject`,
    input
  );
}

export function retryRejectionEmail(applicationId: string): Promise<{ notification: RejectionNotification }> {
  return apiClient.post<{ notification: RejectionNotification }>(`/applications/${applicationId}/reject/retry`, {});
}

export function getRejectionInfo(applicationId: string, signal?: AbortSignal): Promise<{ rejection: RejectionInfo }> {
  return apiClient.get<{ rejection: RejectionInfo }>(`/applications/${applicationId}/reject`, signal);
}
