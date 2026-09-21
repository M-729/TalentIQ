import { apiClient } from "@/services/api/client";
import type { GoogleCalendarStatus } from "@/types/googleCalendar";

export function getGoogleCalendarStatus(signal?: AbortSignal): Promise<GoogleCalendarStatus> {
  return apiClient.get<GoogleCalendarStatus>("/integrations/google-calendar/status", signal);
}

// Returns the Google consent URL — the CALLER must perform an actual
// top-level browser navigation to it (window.location.assign), never an
// iframe/fetch. A raw browser navigation can't carry this app's Bearer
// header, which is exactly why /connect is a normal authenticated JSON
// endpoint rather than a server-side redirect (see backend
// googleCalendarOAuth.controller.ts's connectHandler doc comment).
export function getGoogleCalendarConnectUrl(signal?: AbortSignal): Promise<{ url: string }> {
  return apiClient.get<{ url: string }>("/integrations/google-calendar/connect", signal);
}

export function disconnectGoogleCalendar(): Promise<void> {
  return apiClient.delete<void>("/integrations/google-calendar");
}
