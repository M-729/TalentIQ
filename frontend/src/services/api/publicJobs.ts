import { apiClient } from "@/services/api/client";
import type { ListPublicJobsFilters, Pagination, PublicJob } from "@/types/publicJob";

export function getPublicJob(id: string, signal?: AbortSignal): Promise<{ job: PublicJob }> {
  return apiClient.get<{ job: PublicJob }>(`/public/jobs/${id}`, signal);
}

function buildQuery(filters: ListPublicJobsFilters): string {
  const search = new URLSearchParams();
  if (filters.search) search.set("search", filters.search);
  if (filters.location) search.set("location", filters.location);
  if (filters.employmentType) search.set("employmentType", filters.employmentType);
  if (filters.department) search.set("department", filters.department);
  search.set("page", String(filters.page));
  search.set("limit", String(filters.limit));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listPublicJobs(
  filters: ListPublicJobsFilters,
  signal?: AbortSignal
): Promise<{ jobs: PublicJob[]; pagination: Pagination }> {
  return apiClient.get<{ jobs: PublicJob[]; pagination: Pagination }>(`/public/jobs${buildQuery(filters)}`, signal);
}
