// Mirrors backend src/modules/integrations/googleCalendar/googleCalendarOAuth.controller.ts's
// statusHandler response exactly. Never includes token/OAuth data — see
// that handler's own doc comments for why.
export interface GoogleCalendarStatus {
  connected: boolean;
  account_email?: string;
  connected_at?: string;
  /**
   * Present only when connected: true. Distinguishes "connected and
   * ready" from "connected but the required Calendar permission was not
   * actually granted" — see the backend's Part 10 scope-verification
   * hardening (googleCalendarOAuth.service.ts's exchangeCodeForTokens).
   * Never assume true just because connected is true.
   */
  calendar_permission_granted?: boolean;
}
