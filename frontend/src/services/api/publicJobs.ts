import { apiClient } from "@/services/api/client";
import type { PublicJob } from "@/types/publicJob";

export function getPublicJob(id: string, signal?: AbortSignal): Promise<{ job: PublicJob }> {
  return apiClient.get<{ job: PublicJob }>(`/public/jobs/${id}`, signal);
}
