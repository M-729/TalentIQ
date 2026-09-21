import { CALENDAR_SYNC_ERROR_CODES, type CalendarSyncErrorCode } from "../../../models/Interview.model";

// Re-exported so the rest of this module never has to reach into
// models/Interview.model.ts directly — Interview.model.ts is the single
// source of truth for this taxonomy (see its own doc comment).
export { CALENDAR_SYNC_ERROR_CODES };
export type GoogleCalendarErrorCode = CalendarSyncErrorCode;

/**
 * A provider-neutral, safe error — never wraps or exposes a raw Google
 * error body/stack. See googleCalendar.service.ts's mapGoogleApiError for
 * where a real googleapis error gets translated into one of these; every
 * other module in this codebase only ever sees this type, never the raw
 * googleapis error.
 */
export class GoogleCalendarProviderError extends Error {
  public readonly code: GoogleCalendarErrorCode;
  public readonly providerHttpStatus?: number;
  /**
   * Google's own short structured-error `reason`/`status` identifier
   * (e.g. "insufficientPermissions", "quotaExceeded",
   * "forbiddenForNonOrganizer") — NOT the human-readable `message`, which
   * can contain request-specific detail and must never be captured here.
   * This is a fixed, documented enum-like token Google itself defines, so
   * it is safe to log for diagnostics (see googleCalendar.service.ts's
   * mapGoogleApiError) without risking exposure of tokens, PII, or raw
   * response bodies. Optional — a generic/network-level failure has none.
   */
  public readonly providerReason?: string;

  constructor(code: GoogleCalendarErrorCode, message: string, providerHttpStatus?: number, providerReason?: string) {
    super(message);
    this.name = "GoogleCalendarProviderError";
    this.code = code;
    this.providerHttpStatus = providerHttpStatus;
    this.providerReason = providerReason;
  }
}

export interface GoogleCalendarEventInput {
  summary: string;
  description: string;
  startsAt: Date;
  endsAt: Date;
  timezone: string;
  attendeeEmails: string[];
  /** A fresh, unique id per conferenceData.createRequest — never reused across calls. */
  conferenceRequestId: string;
}

export interface GoogleCalendarEventResult {
  eventId: string;
  /** null when Google's conference creation is still pending (see googleCalendarSync — async Meet generation). */
  meetingUrl: string | null;
  conferencePending: boolean;
}

/**
 * The clean abstraction Interview sync code depends on — never `googleapis`
 * directly (see interviewCalendarSync.service.ts). Every method takes an
 * already-decrypted refresh token (decrypted just-in-time by the caller,
 * never persisted in memory longer than one call) and normalizes whatever
 * googleapis throws into GoogleCalendarProviderError. Tests mock this
 * entire module (see googleCalendarProvider.ts) so no test ever reaches
 * real Google.
 */
export interface GoogleCalendarProvider {
  createEvent(refreshToken: string, input: GoogleCalendarEventInput): Promise<GoogleCalendarEventResult>;
  updateEvent(refreshToken: string, eventId: string, input: GoogleCalendarEventInput): Promise<GoogleCalendarEventResult>;
  cancelEvent(refreshToken: string, eventId: string): Promise<void>;
  getEvent(refreshToken: string, eventId: string): Promise<GoogleCalendarEventResult>;
}
