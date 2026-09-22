import { apiClient } from "@/services/api/client";
import type { InterviewFeedback, InterviewFeedbackList, SaveFeedbackDraftInput, SubmitFeedbackInput } from "@/types/interviewFeedback";

export function listInterviewFeedback(interviewId: string, signal?: AbortSignal): Promise<InterviewFeedbackList> {
  return apiClient.get<InterviewFeedbackList>(`/interviews/${interviewId}/feedback`, signal);
}

// Who is saving is always the authenticated caller — there is no
// interviewer_user_id field to send here (see interviewFeedback.validation.ts's
// .strict() schema, which doesn't accept one).
export function saveOwnFeedbackDraft(interviewId: string, input: SaveFeedbackDraftInput): Promise<{ feedback: InterviewFeedback }> {
  return apiClient.put<{ feedback: InterviewFeedback }>(`/interviews/${interviewId}/feedback/me`, input);
}

export function submitOwnFeedback(interviewId: string, input: SubmitFeedbackInput): Promise<{ feedback: InterviewFeedback }> {
  return apiClient.post<{ feedback: InterviewFeedback }>(`/interviews/${interviewId}/feedback/me/submit`, input);
}
