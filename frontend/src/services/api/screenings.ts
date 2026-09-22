import { apiClient } from "@/services/api/client";
import type { Screening, ScreeningStatus } from "@/types/screening";

export interface LatestScreeningResponse {
  screening: Screening | null;
  status: ScreeningStatus;
}

// GET latest/history are plain database reads — they must never trigger an
// AI call. Only createScreening() below does (a real Groq request), which
// is why it's the only one ever wired to an explicit user action (a
// button click: Start Screening / Retry Screening), never to a useEffect
// on mount.
export function getLatestScreening(applicationId: string, signal?: AbortSignal): Promise<LatestScreeningResponse> {
  return apiClient.get<LatestScreeningResponse>(`/applications/${applicationId}/screenings/latest`, signal);
}

export function getScreeningHistory(applicationId: string, signal?: AbortSignal): Promise<{ screenings: Screening[] }> {
  return apiClient.get<{ screenings: Screening[] }>(`/applications/${applicationId}/screenings`, signal);
}

// Explicitly triggers a new AI screening — creates a new append-only
// history record. Only ever called from a direct user action (Run AI
// Screening / confirmed Re-run Screening), never automatically.
export function createScreening(applicationId: string): Promise<{ screening: Screening }> {
  return apiClient.post<{ screening: Screening }>(`/applications/${applicationId}/screenings`);
}
