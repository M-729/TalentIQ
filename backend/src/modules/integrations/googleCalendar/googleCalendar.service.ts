import { google, type calendar_v3 } from "googleapis";
import { env } from "../../../config/env";
import { GoogleCalendarProviderError } from "./googleCalendar.types";
import type { GoogleCalendarEventInput, GoogleCalendarEventResult, GoogleCalendarProvider } from "./googleCalendar.types";

const CALENDAR_ID = "primary";

function buildOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    // Mirrors the R2/SMTP/GROQ "unconfigured -> clear error at the point
    // of use" convention this codebase already established.
    throw new Error("Google OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI)");
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

function buildCalendarClient(refreshToken: string) {
  const auth = buildOAuthClient();
  auth.setCredentials({ refresh_token: refreshToken });
  return google.calendar({ version: "v3", auth });
}

function extractHttpStatus(err: unknown): number | undefined {
  if (typeof err === "object" && err !== null) {
    const maybe = err as { code?: unknown; response?: { status?: unknown } };
    if (typeof maybe.response?.status === "number") return maybe.response.status;
    if (typeof maybe.code === "number") return maybe.code;
  }
  return undefined;
}

/**
 * Reads ONLY Google's short, structured `reason` (Calendar API v3's
 * legacy `error.errors[].reason` shape) or `status` (the newer
 * `error.status` shape some Google APIs use) identifier — never the
 * human-readable `error.message`, and never any other part of the
 * response body. Both are fixed, documented enum-like tokens Google
 * itself defines (e.g. "insufficientPermissions", "quotaExceeded"), so
 * this is safe to surface for diagnostics even though the rest of the
 * response body is not (see GoogleCalendarProviderError's own doc
 * comment).
 */
function extractGoogleErrorReason(err: unknown): string | undefined {
  if (typeof err !== "object" || err === null) return undefined;
  const data = (err as { response?: { data?: unknown } }).response?.data;
  if (typeof data !== "object" || data === null) return undefined;
  const apiError = (data as { error?: unknown }).error;
  if (typeof apiError !== "object" || apiError === null) return undefined;

  const errors = (apiError as { errors?: unknown }).errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const reason = (errors[0] as { reason?: unknown } | undefined)?.reason;
    if (typeof reason === "string") return reason;
  }

  const status = (apiError as { status?: unknown }).status;
  return typeof status === "string" ? status : undefined;
}

// Reasons Google documents as specifically about the CALLER'S
// authorization (an expired/insufficient grant, missing scope) — only
// these ever map a 403 to authorization_required. An unrecognized 403
// reason is deliberately NEVER assumed to mean this; see the 403 branch
// below.
const AUTHORIZATION_REASONS = new Set(["authError", "insufficientPermissions", "insufficientScopes"]);
// Google's documented rate/quota reasons for a 403 (Calendar API v3 also
// returns these as 403s, not just 429s).
const RATE_LIMIT_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded", "quotaExceeded", "dailyLimitExceeded"]);
// A 403 caused by the calling project's own API/service configuration
// (e.g. the Calendar API not being enabled) — not something reconnecting
// the user's Google account can fix, and not a transient rate/quota
// issue either. This codebase's error taxonomy has no dedicated
// "configuration" code, so provider_unavailable (a real
// CALENDAR_SYNC_ERROR_CODES member — see Interview.model.ts) is the
// closest honest fit: it's retryable and doesn't tell the user to
// reconnect.
const CONFIGURATION_REASONS = new Set(["accessNotConfigured"]);

/**
 * Translates whatever googleapis throws into a safe, provider-neutral
 * GoogleCalendarProviderError — this is the ONLY place a raw Google
 * error's shape is inspected. No caller of this module ever sees the
 * original error, its message, or its stack (never logged either — see
 * interviewCalendarSync.service.ts, which only logs { interviewId,
 * operation, code, providerHttpStatus, providerReason }, all of which are
 * either our own safe enum or Google's own short structured-error
 * identifier, never raw message/body/stack).
 *
 * A 403 is deliberately NOT treated as automatically meaning
 * "reconnect": Google Calendar returns 403 for several unrelated causes
 * (rate/quota limits, the caller's own API not being enabled, a
 * forbidden-but-authorized operation like a non-organizer editing an
 * event), and telling a still-validly-connected user to reconnect their
 * Google account for any of those is actively misleading. Only a
 * whitelisted, Google-documented authorization-specific reason (see
 * AUTHORIZATION_REASONS above) ever produces authorization_required for
 * a 403 — a 401 always does, since that status code IS specifically
 * "your credentials are invalid".
 */
function mapGoogleApiError(err: unknown): GoogleCalendarProviderError {
  const status = extractHttpStatus(err);
  const reason = extractGoogleErrorReason(err);

  if (status === 401) {
    return new GoogleCalendarProviderError("authorization_required", "Google authorization is no longer valid", status, reason);
  }
  if (status === 403) {
    if (reason && AUTHORIZATION_REASONS.has(reason)) {
      return new GoogleCalendarProviderError("authorization_required", "Google authorization is no longer valid", status, reason);
    }
    if (reason && RATE_LIMIT_REASONS.has(reason)) {
      return new GoogleCalendarProviderError("rate_limited", "Google Calendar rate limit reached", status, reason);
    }
    if (reason && CONFIGURATION_REASONS.has(reason)) {
      return new GoogleCalendarProviderError("provider_unavailable", "Google Calendar is temporarily unavailable", status, reason);
    }
    // Covers documented-but-unrelated reasons (e.g. forbiddenForNonOrganizer)
    // and any unrecognized reason alike.
    return new GoogleCalendarProviderError("provider_error", "Google Calendar request failed", status, reason);
  }
  if (status === 404) {
    return new GoogleCalendarProviderError("event_not_found", "The Google Calendar event was not found", status, reason);
  }
  if (status === 429) {
    return new GoogleCalendarProviderError("rate_limited", "Google Calendar rate limit reached", status, reason);
  }
  if (typeof status === "number" && status >= 500) {
    return new GoogleCalendarProviderError("provider_unavailable", "Google Calendar is temporarily unavailable", status, reason);
  }
  return new GoogleCalendarProviderError("provider_error", "Google Calendar request failed", status, reason);
}

/**
 * Normalizes a raw Google Calendar API event into this module's own
 * result shape. The Meet URL is read ONLY from
 * conferenceData.entryPoints (entryPointType: "video") — never
 * constructed/guessed — and conference creation is treated as pending
 * whenever Google's own createRequest status says "pending", or (on a
 * plain get/refresh, where createRequest isn't echoed back) whenever
 * conferenceData exists but no video entry point has appeared yet.
 */
function extractEventResult(event: calendar_v3.Schema$Event): GoogleCalendarEventResult {
  if (!event.id) {
    throw new GoogleCalendarProviderError("provider_error", "Google Calendar did not return an event id");
  }

  const videoEntryPoint = event.conferenceData?.entryPoints?.find((entryPoint) => entryPoint.entryPointType === "video");
  const createStatus = event.conferenceData?.createRequest?.status?.statusCode;
  const conferencePending = createStatus === "pending" || (!!event.conferenceData && !videoEntryPoint);

  return {
    eventId: event.id,
    meetingUrl: videoEntryPoint?.uri ?? null,
    conferencePending,
  };
}

function buildRequestBody(input: GoogleCalendarEventInput): calendar_v3.Schema$Event {
  return {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startsAt.toISOString(), timeZone: input.timezone },
    end: { dateTime: input.endsAt.toISOString(), timeZone: input.timezone },
    attendees: input.attendeeEmails.map((email) => ({ email })),
    conferenceData: {
      createRequest: {
        requestId: input.conferenceRequestId,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    },
  };
}

export const realGoogleCalendarProvider: GoogleCalendarProvider = {
  async createEvent(refreshToken, input) {
    try {
      const calendar = buildCalendarClient(refreshToken);
      const res = await calendar.events.insert({
        calendarId: CALENDAR_ID,
        sendUpdates: "all",
        conferenceDataVersion: 1,
        requestBody: buildRequestBody(input),
      });
      return extractEventResult(res.data);
    } catch (err) {
      if (err instanceof GoogleCalendarProviderError) throw err;
      throw mapGoogleApiError(err);
    }
  },

  async updateEvent(refreshToken, eventId, input) {
    try {
      const calendar = buildCalendarClient(refreshToken);
      // patch (not update) — only the fields in requestBody are changed;
      // this is what lets a reschedule leave existing conference data
      // alone unless we're also re-requesting one.
      const res = await calendar.events.patch({
        calendarId: CALENDAR_ID,
        eventId,
        sendUpdates: "all",
        conferenceDataVersion: 1,
        requestBody: buildRequestBody(input),
      });
      return extractEventResult(res.data);
    } catch (err) {
      if (err instanceof GoogleCalendarProviderError) throw err;
      throw mapGoogleApiError(err);
    }
  },

  async cancelEvent(refreshToken, eventId) {
    try {
      const calendar = buildCalendarClient(refreshToken);
      await calendar.events.delete({ calendarId: CALENDAR_ID, eventId, sendUpdates: "all" });
    } catch (err) {
      // Google returns 410 Gone for an event already deleted — treat that
      // the same as success (idempotent cancel), never a failure to retry
      // forever.
      const status = extractHttpStatus(err);
      if (status === 410 || status === 404) return;
      throw mapGoogleApiError(err);
    }
  },

  async getEvent(refreshToken, eventId) {
    try {
      const calendar = buildCalendarClient(refreshToken);
      const res = await calendar.events.get({ calendarId: CALENDAR_ID, eventId });
      return extractEventResult(res.data);
    } catch (err) {
      if (err instanceof GoogleCalendarProviderError) throw err;
      throw mapGoogleApiError(err);
    }
  },
};
