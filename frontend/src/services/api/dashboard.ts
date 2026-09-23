import { apiClient } from "@/services/api/client";
import type { Dashboard } from "@/types/dashboard";

export function getDashboard(signal?: AbortSignal): Promise<Dashboard> {
  return apiClient.get<Dashboard>("/dashboard", signal);
}
