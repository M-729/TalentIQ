import { apiClient } from "@/services/api/client";
import type { Pagination } from "@/types/application";
import type { EmailActivityRow, ListEmailActivityFilters } from "@/types/emailActivity";

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function listEmailActivity(
  filters: ListEmailActivityFilters,
  signal?: AbortSignal
): Promise<{ emails: EmailActivityRow[]; pagination: Pagination }> {
  const query = buildQuery({
    search: filters.search,
    type: filters.type,
    status: filters.status,
    page: filters.page,
    limit: filters.limit,
  });
  return apiClient.get<{ emails: EmailActivityRow[]; pagination: Pagination }>(`/email-activity${query}`, signal);
}
