import { apiClient } from "@/services/api/client";
import type { InterviewNotification } from "@/types/interviewNotification";

export function listInterviewNotifications(
  interviewId: string,
  signal?: AbortSignal
): Promise<{ notifications: InterviewNotification[] }> {
  return apiClient.get<{ notifications: InterviewNotification[] }>(`/interviews/${interviewId}/notifications`, signal);
}

// Only a FAILED notification is retryable — the backend enforces this
// (409 otherwise); recipient/content are always reconstructed from
// trusted persisted data server-side, never sent from here.
export function retryInterviewNotification(notificationId: string): Promise<{ notification: InterviewNotification }> {
  return apiClient.post<{ notification: InterviewNotification }>(`/interview-notifications/${notificationId}/retry`, {});
}
