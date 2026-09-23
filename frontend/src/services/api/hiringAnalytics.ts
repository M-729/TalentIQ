import { apiClient } from "@/services/api/client";
import type { AnalyticsRange, HiringAnalytics } from "@/types/hiringAnalytics";

function buildQuery(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function getHiringAnalytics(
  filters: { range: AnalyticsRange; jobId?: string },
  signal?: AbortSignal
): Promise<HiringAnalytics> {
  const query = buildQuery({ range: filters.range, jobId: filters.jobId });
  return apiClient.get<HiringAnalytics>(`/hiring-analytics${query}`, signal);
}
