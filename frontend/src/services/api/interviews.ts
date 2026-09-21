import { apiClient } from "@/services/api/client";
import type {
  CancelInterviewInput,
  Interview,
  InterviewDetail,
  InterviewListRow,
  ListInterviewsFilters,
  Pagination,
  RescheduleInterviewInput,
  ScheduleInterviewInput,
} from "@/types/interview";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export interface ListInterviewsResult {
  interviews: InterviewListRow[];
  pagination: Pagination;
}

// Company-wide list for the /interviews page.
export function listInterviews(filters: ListInterviewsFilters = {}, signal?: AbortSignal): Promise<ListInterviewsResult> {
  const query = buildQuery({
    status: filters.status,
    jobId: filters.jobId,
    when: filters.when,
    page: filters.page,
    limit: filters.limit,
  });
  return apiClient.get<ListInterviewsResult>(`/interviews${query}`, signal);
}

// Scoped to a single Application — the Application Detail page's Interviews section.
export function listApplicationInterviews(applicationId: string, signal?: AbortSignal): Promise<{ interviews: Interview[] }> {
  return apiClient.get<{ interviews: Interview[] }>(`/applications/${applicationId}/interviews`, signal);
}

export function getInterview(interviewId: string, signal?: AbortSignal): Promise<{ interview: InterviewDetail }> {
  return apiClient.get<{ interview: InterviewDetail }>(`/interviews/${interviewId}`, signal);
}

// Always an explicit HR action — never called automatically on a stage move.
export function scheduleInterview(applicationId: string, input: ScheduleInterviewInput): Promise<{ interview: Interview }> {
  return apiClient.post<{ interview: Interview }>(`/applications/${applicationId}/interviews`, input);
}

export function rescheduleInterview(interviewId: string, input: RescheduleInterviewInput): Promise<{ interview: Interview }> {
  return apiClient.patch<{ interview: Interview }>(`/interviews/${interviewId}/reschedule`, input);
}

export function cancelInterview(interviewId: string, input: CancelInterviewInput): Promise<{ interview: Interview }> {
  return apiClient.patch<{ interview: Interview }>(`/interviews/${interviewId}/cancel`, input);
}

// Explicit "Add to Google Calendar" — never called automatically when a page opens.
export function createGoogleCalendarEvent(interviewId: string): Promise<{ interview: Interview }> {
  return apiClient.post<{ interview: Interview }>(`/interviews/${interviewId}/google-calendar`, {});
}

// The one retry/reconciliation endpoint ("Sync Calendar").
export function syncGoogleCalendarEvent(interviewId: string): Promise<{ interview: Interview }> {
  return apiClient.post<{ interview: Interview }>(`/interviews/${interviewId}/google-calendar/sync`, {});
}
