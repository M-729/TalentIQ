import { apiClient } from "@/services/api/client";
import type {
  ApplicationAssessment,
  AssessmentHistoryItem,
  AssessmentListRow,
  AssessmentNotification,
  CreateAssessmentInput,
  ListAssessmentsFilters,
  Pagination,
  RecordAssessmentResultInput,
  UpdateAssessmentLinkInput,
} from "@/types/applicationAssessment";

// The backend also exposes GET /applications/:applicationId/assessment
// (the current-stage record alone), but the frontend deliberately uses
// only the history endpoint below — it already includes the current-stage
// record (tagged is_current: true) alongside every historical one, so a
// second request just to also learn "the current one" would be redundant
// (see this ticket's explicit "efficient Application-level history
// query" instruction, and ApplicationAssessmentSection.tsx, which derives
// both from this one fetch).

// Every assessment record this Application has ever had, across every
// assessment-type stage it has ever moved through — never just the
// current one. This is what lets Application Detail keep a Passed/Failed
// result readable after the candidate moves on to another stage.
export function getAssessmentHistoryForApplication(
  applicationId: string,
  signal?: AbortSignal
): Promise<{ assessments: AssessmentHistoryItem[] }> {
  return apiClient.get<{ assessments: AssessmentHistoryItem[] }>(`/applications/${applicationId}/assessment/history`, signal);
}

// Never sends an email — see the explicit, separate sendAssessmentInvitation below.
export function createAssessment(applicationId: string, input: CreateAssessmentInput): Promise<{ assessment: ApplicationAssessment }> {
  return apiClient.post<{ assessment: ApplicationAssessment }>(`/applications/${applicationId}/assessment`, input);
}

// name/external_url only — never touches status/grade/notes/audit fields,
// and never re-sends the invitation email on its own (see this ticket's
// explicit Part 7).
export function updateAssessmentLink(assessmentId: string, input: UpdateAssessmentLinkInput): Promise<{ assessment: ApplicationAssessment }> {
  return apiClient.patch<{ assessment: ApplicationAssessment }>(`/application-assessments/${assessmentId}`, input);
}

// Never moves/rejects/hires the Application — assessment results are
// evidence only (see this ticket's explicit Part 19/28).
export function recordAssessmentResult(
  assessmentId: string,
  input: RecordAssessmentResultInput
): Promise<{ assessment: ApplicationAssessment }> {
  return apiClient.patch<{ assessment: ApplicationAssessment }>(`/application-assessments/${assessmentId}/result`, input);
}

// The one explicit "Send Assessment" / "Send Again" action — always
// creates a brand-new communication event server-side, never triggered
// automatically by creating/editing the assessment.
export function sendAssessmentInvitation(assessmentId: string): Promise<{ notification: AssessmentNotification }> {
  return apiClient.post<{ notification: AssessmentNotification }>(`/application-assessments/${assessmentId}/send`, {});
}

export function listAssessmentNotifications(assessmentId: string, signal?: AbortSignal): Promise<{ notifications: AssessmentNotification[] }> {
  return apiClient.get<{ notifications: AssessmentNotification[] }>(`/application-assessments/${assessmentId}/notifications`, signal);
}

// Only a FAILED notification is retryable (the backend enforces this,
// 409 otherwise); recipient/content are always reconstructed from the
// notification's own immutable snapshot server-side, never sent from here.
export function retryAssessmentNotification(assessmentId: string, notificationId: string): Promise<{ notification: AssessmentNotification }> {
  return apiClient.post<{ notification: AssessmentNotification }>(
    `/application-assessments/${assessmentId}/notifications/${notificationId}/retry`,
    {}
  );
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

// The /assessments company-wide list.
export function listAssessments(
  filters: ListAssessmentsFilters,
  signal?: AbortSignal
): Promise<{ assessments: AssessmentListRow[]; pagination: Pagination }> {
  const query = buildQuery({
    jobId: filters.jobId,
    status: filters.status,
    search: filters.search,
    page: filters.page,
    limit: filters.limit,
  });
  return apiClient.get<{ assessments: AssessmentListRow[]; pagination: Pagination }>(`/application-assessments${query}`, signal);
}
