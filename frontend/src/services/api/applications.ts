import { apiClient } from "@/services/api/client";
import type { ApplicationDetail, ApplicationListRow, ApplicationStatus, Pagination, SubmitApplicationInput } from "@/types/application";

export function submitApplication(
  jobId: string,
  payload: SubmitApplicationInput,
  cvFile: File
): Promise<{ message: string }> {
  const formData = new FormData();
  formData.set("full_name", payload.full_name);
  formData.set("email", payload.email);
  if (payload.phone) formData.set("phone", payload.phone);
  if (payload.location) formData.set("location", payload.location);
  if (payload.linkedin_url) formData.set("linkedin_url", payload.linkedin_url);
  if (payload.portfolio_url) formData.set("portfolio_url", payload.portfolio_url);
  // Field name must match the backend's multer field: "cv".
  formData.set("cv", cvFile);

  return apiClient.post<{ message: string }>(`/public/jobs/${jobId}/applications`, formData);
}

export interface ListApplicationsParams {
  search?: string;
  jobId?: string;
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

// Authenticated, HR/Admin-only — distinct from submitApplication above
// (public, unauthenticated candidate submission). Every filter is passed
// straight through as a query param; the backend is the source of truth
// for validating/scoping them (company isolation, malformed-id checks) —
// this function never filters or trusts anything client-side.
export function getApplications(
  params: ListApplicationsParams,
  signal?: AbortSignal
): Promise<{ applications: ApplicationListRow[]; pagination: Pagination }> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.jobId) query.set("jobId", params.jobId);
  if (params.status) query.set("status", params.status);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  const queryString = query.toString();

  return apiClient.get<{ applications: ApplicationListRow[]; pagination: Pagination }>(
    `/applications${queryString ? `?${queryString}` : ""}`,
    signal
  );
}

export function getApplication(applicationId: string, signal?: AbortSignal): Promise<{ application: ApplicationDetail }> {
  return apiClient.get<{ application: ApplicationDetail }>(`/applications/${applicationId}`, signal);
}
