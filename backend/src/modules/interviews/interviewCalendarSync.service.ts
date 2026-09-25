import crypto from "node:crypto";
import { Interview, type InterviewDoc } from "../../models/Interview.model";
import type { CalendarSyncErrorCode } from "../../models/Interview.model";
import { Application } from "../../models/Application.model";
import { Candidate } from "../../models/Candidate.model";
import { Job } from "../../models/Job.model";
import { User } from "../../models/User.model";
import { GoogleCalendarConnection } from "../../models/GoogleCalendarConnection.model";
import { BadGatewayError, ConflictError, ServiceUnavailableError } from "../../security/AppError";
import { getAccessibleInterview, getAccessibleInterviewForActiveJob } from "./interviewAccess.service";
import {
  decryptConnectionRefreshToken,
  getActiveConnection,
} from "../integrations/googleCalendar/googleCalendarConnection.service";
import { googleCalendarProvider, GoogleCalendarProviderError } from "../integrations/googleCalendar/googleCalendarProvider";
import type { GoogleCalendarEventInput, GoogleCalendarEventResult } from "../integrations/googleCalendar/googleCalendarProvider";

const NOT_SCHEDULED_MESSAGE = "This interview is not currently scheduled.";
const ALREADY_HAS_EVENT_MESSAGE = "This interview already has a Google Calendar event. Use sync to refresh it.";
const NOT_CONNECTED_MESSAGE = "Connect your Google Calendar to schedule interview events.";
const NO_INTEGRATION_MESSAGE = "This interview has no Google Calendar integration to synchronize.";
const OWNER_DISCONNECTED_MESSAGE =
  "The Google account that owns this event is no longer connected. Ask them to reconnect, or contact an admin.";
const MISSING_CALENDAR_PERMISSION_MESSAGE =
  "The connected Google account did not grant Calendar permission. Reconnect Google Calendar and approve the Calendar permission this time.";
const OWNER_MISSING_CALENDAR_PERMISSION_MESSAGE =
  "The Google account that owns this event did not grant Calendar permission. Ask them to reconnect and approve the Calendar permission, or contact an admin.";

/**
 * Never a raw Google error reaches the client — this is the one place a
 * GoogleCalendarProviderError's safe `code` is translated into an
 * AppError with a safe message. Deliberately generic/consistent per
 * code, not per-call, so a client can build one shared handling path.
 */
function mapProviderErrorToAppError(err: GoogleCalendarProviderError) {
  switch (err.code) {
    case "authorization_required":
      return new ConflictError("The connected Google account needs to be reconnected before this can sync.");
    case "event_not_found":
      return new ConflictError("The linked Google Calendar event could not be found.");
    case "rate_limited":
      return new ServiceUnavailableError("Google Calendar is temporarily rate-limited. Please try again shortly.");
    case "provider_unavailable":
      return new ServiceUnavailableError("Google Calendar is temporarily unavailable. Please try again shortly.");
    default:
      return new BadGatewayError("Google Calendar could not complete this request. Please try again.");
  }
}

function toProviderError(err: unknown): GoogleCalendarProviderError {
  return err instanceof GoogleCalendarProviderError
    ? err
    : new GoogleCalendarProviderError("provider_error", "Google Calendar request failed");
}

/**
 * Logs only safe metadata — interview id, which operation, the safe
 * error code, the provider's raw HTTP status if any, and Google's own
 * short structured-error reason/status identifier if any (e.g.
 * "insufficientPermissions", "quotaExceeded" — a fixed, documented
 * enum-like token, not free text; see GoogleCalendarProviderError's doc
 * comment). NEVER the candidate/interviewer emails, the refresh/access
 * token, an authorization code, the client secret, or the original
 * Google error's message/body/stack (see googleCalendar.service.ts's
 * mapGoogleApiError, which already stripped all of that before this ever
 * sees it).
 */
function logSafeProviderFailure(interviewId: string, operation: string, err: GoogleCalendarProviderError): void {
  console.error("[googleCalendar] sync failed", {
    interviewId,
    operation,
    code: err.code,
    providerHttpStatus: err.providerHttpStatus,
    providerReason: err.providerReason,
  });
}

/**
 * Resolves attendee emails ENTIRELY from persisted TalentIQ data — the
 * candidate via Application, and every current interviewer via User.
 * There is no code path anywhere that accepts an attendee email from a
 * request body; this is deliberate (see this ticket's explicit "do not
 * accept arbitrary attendee emails" rule) — a client can never turn this
 * integration into an unrestricted calendar/email sender. Deduplicated
 * case-insensitively.
 */
async function resolveAttendeeEmails(interview: InterviewDoc): Promise<string[]> {
  const application = await Application.findById(interview.application_id).select("candidate_id");
  const candidate = application ? await Candidate.findById(application.candidate_id).select("email") : null;
  const interviewers = await User.find({ _id: { $in: interview.interviewer_user_ids } }).select("email");

  const emails = new Set<string>();
  if (candidate?.email) {
    emails.add(candidate.email.toLowerCase());
  }
  for (const interviewer of interviewers) {
    emails.add(interviewer.email.toLowerCase());
  }
  return [...emails];
}

/**
 * Deliberately minimal/professional — never AI score, CV analysis,
 * screening gaps, internal HR notes, raw ids, or any secret (see this
 * ticket's explicit content restriction). Just enough for the
 * interviewer/candidate to know what this event is for.
 */
async function buildEventInput(interview: InterviewDoc, attendeeEmails: string[]): Promise<GoogleCalendarEventInput> {
  const job = await Job.findById(interview.job_id).select("title");
  return {
    summary: interview.title,
    description: `TalentIQ interview for: ${job?.title ?? "this role"}`,
    startsAt: interview.starts_at,
    endsAt: interview.ends_at,
    timezone: interview.timezone,
    attendeeEmails,
    // Fresh per call, never reused — required for
    // conferenceData.createRequest (see googleCalendar.service.ts).
    conferenceRequestId: crypto.randomUUID(),
  };
}

async function applySyncSuccess(
  interviewId: string,
  ownerUserId: string,
  result: GoogleCalendarEventResult
): Promise<InterviewDoc> {
  const updated = await Interview.findByIdAndUpdate(
    interviewId,
    {
      $set: {
        calendar_provider: "google",
        calendar_owner_user_id: ownerUserId,
        calendar_event_id: result.eventId,
        meeting_url: result.meetingUrl,
        calendar_sync_status: result.conferencePending ? "pending" : "synced",
        // Reuses the same safe-code field for a non-error informational
        // reason (Meet conference creation is async and may not be ready
        // immediately) — see Interview.model.ts's CALENDAR_SYNC_ERROR_CODES
        // doc comment.
        calendar_sync_error_code: result.conferencePending ? "conference_pending" : null,
        calendar_last_synced_at: new Date(),
      },
    },
    { new: true }
  );
  return updated!;
}

async function markSyncFailed(interviewId: string, errorCode: CalendarSyncErrorCode): Promise<void> {
  await Interview.updateOne(
    { _id: interviewId },
    { $set: { calendar_sync_status: "failed", calendar_sync_error_code: errorCode, calendar_last_synced_at: new Date() } }
  );
}

async function markCreateAttemptFailed(interviewId: string, userId: string, errorCode: CalendarSyncErrorCode): Promise<void> {
  // Unlike markSyncFailed, this also records that an attempt was made and
  // by whom — a later explicit sync/retry needs calendar_provider +
  // calendar_owner_user_id to know "there's an in-progress Google
  // integration for this interview, owned by this user, retry the
  // create" rather than treating it as "no integration exists".
  await Interview.updateOne(
    { _id: interviewId },
    {
      $set: {
        calendar_provider: "google",
        calendar_owner_user_id: userId,
        calendar_sync_status: "failed",
        calendar_sync_error_code: errorCode,
        calendar_last_synced_at: new Date(),
      },
    }
  );
}

/**
 * Batches "is the owner's Google connection currently active" across a
 * whole list of Interviews into ONE query — never one lookup per
 * Interview. Used by the serializer's `calendar.connected` field (see
 * interview.serializer.ts) so the frontend can show "the owner
 * disconnected" safely without ever seeing OAuth details.
 */
export async function batchOwnerConnectionStatus(interviews: InterviewDoc[]): Promise<Map<string, boolean>> {
  const ownerIds = new Set<string>();
  for (const interview of interviews) {
    if (interview.calendar_owner_user_id) {
      ownerIds.add(interview.calendar_owner_user_id.toString());
    }
  }
  if (ownerIds.size === 0) {
    return new Map();
  }

  const activeConnections = await GoogleCalendarConnection.find({
    user_id: { $in: [...ownerIds] },
    revoked_at: null,
  }).select("user_id");
  const connectedOwnerIds = new Set(activeConnections.map((connection) => connection.user_id.toString()));

  return new Map([...ownerIds].map((id) => [id, connectedOwnerIds.has(id)]));
}

/**
 * Explicit "create/synchronize this scheduled Interview into my
 * connected Google Calendar" action — never creates a second Interview,
 * only ever the ONE Google Calendar event for an existing one. Requires
 * an active Job (soft-deleted Jobs block NEW event creation, matching
 * every other "start something new" gate in this codebase).
 */
export async function createGoogleCalendarEvent(companyId: string, userId: string, interviewId: string): Promise<InterviewDoc> {
  const interview = await getAccessibleInterviewForActiveJob(interviewId, companyId);

  if (interview.status !== "scheduled") {
    throw new ConflictError(NOT_SCHEDULED_MESSAGE);
  }
  if (interview.calendar_event_id) {
    throw new ConflictError(ALREADY_HAS_EVENT_MESSAGE);
  }

  const connection = await getActiveConnection(userId);
  if (!connection) {
    throw new ConflictError(NOT_CONNECTED_MESSAGE);
  }
  if (!connection.calendar_permission_granted) {
    // Fails fast on our own verified record rather than letting this
    // reach Google and get back a 403 whose `reason` may or may not
    // cleanly say so (see googleCalendar.service.ts's mapGoogleApiError
    // doc comment — a 403's reason is not always reliably diagnostic).
    throw new ConflictError(MISSING_CALENDAR_PERMISSION_MESSAGE);
  }

  const attendeeEmails = await resolveAttendeeEmails(interview);
  const eventInput = await buildEventInput(interview, attendeeEmails);
  const refreshToken = decryptConnectionRefreshToken(connection);

  try {
    const result = await googleCalendarProvider.createEvent(refreshToken, eventInput);
    return await applySyncSuccess(interview.id, userId, result);
  } catch (err) {
    const mapped = toProviderError(err);
    await markCreateAttemptFailed(interview.id, userId, mapped.code);
    logSafeProviderFailure(interview.id, "create", mapped);
    throw mapProviderErrorToAppError(mapped);
  }
}

/**
 * The one explicit retry/reconciliation endpoint — never provider-
 * specific hacks scattered elsewhere. Behavior branches on the
 * Interview's own state (see this ticket's explicit spec):
 *   - cancelled + event still exists -> retry cancellation
 *   - scheduled + no event yet -> retry as an initial create
 *   - scheduled + event pending -> refresh (GET) to check for the Meet link
 *   - scheduled + event failed/synced -> re-patch with current data (idempotent)
 *
 * Uses the HISTORICAL access variant (not the active-Job one) — retrying
 * a CANCEL sync must remain possible even after the Job is soft-deleted
 * (cancellation cleanup is always allowed; see interview.service.ts's
 * cancelInterview doc comment for the same policy applied there).
 */
export async function syncGoogleCalendarEvent(companyId: string, interviewId: string): Promise<InterviewDoc> {
  const interview = await getAccessibleInterview(interviewId, companyId);

  if (!interview.calendar_provider || !interview.calendar_owner_user_id) {
    throw new ConflictError(NO_INTEGRATION_MESSAGE);
  }

  const ownerUserId = interview.calendar_owner_user_id.toString();
  const connection = await getActiveConnection(ownerUserId);
  if (!connection) {
    await markSyncFailed(interview.id, "authorization_required");
    throw new ConflictError(OWNER_DISCONNECTED_MESSAGE);
  }
  if (!connection.calendar_permission_granted) {
    await markSyncFailed(interview.id, "authorization_required");
    throw new ConflictError(OWNER_MISSING_CALENDAR_PERMISSION_MESSAGE);
  }
  const refreshToken = decryptConnectionRefreshToken(connection);

  if (interview.status === "cancelled") {
    if (!interview.calendar_event_id) {
      return interview;
    }
    try {
      await googleCalendarProvider.cancelEvent(refreshToken, interview.calendar_event_id);
    } catch (err) {
      const mapped = toProviderError(err);
      await markSyncFailed(interview.id, mapped.code);
      logSafeProviderFailure(interview.id, "cancel-sync", mapped);
      throw mapProviderErrorToAppError(mapped);
    }
    const updated = await Interview.findByIdAndUpdate(
      interview.id,
      { $set: { calendar_sync_status: "synced", calendar_sync_error_code: null, calendar_last_synced_at: new Date() } },
      { new: true }
    );
    return updated!;
  }

  const attendeeEmails = await resolveAttendeeEmails(interview);

  try {
    let result: GoogleCalendarEventResult;
    if (!interview.calendar_event_id) {
      result = await googleCalendarProvider.createEvent(refreshToken, await buildEventInput(interview, attendeeEmails));
    } else if (interview.calendar_sync_status === "pending") {
      result = await googleCalendarProvider.getEvent(refreshToken, interview.calendar_event_id);
    } else {
      result = await googleCalendarProvider.updateEvent(
        refreshToken,
        interview.calendar_event_id,
        await buildEventInput(interview, attendeeEmails)
      );
    }
    return await applySyncSuccess(interview.id, ownerUserId, result);
  } catch (err) {
    const mapped = toProviderError(err);
    await markSyncFailed(interview.id, mapped.code);
    logSafeProviderFailure(interview.id, "sync", mapped);
    throw mapProviderErrorToAppError(mapped);
  }
}

/**
 * Called from the controller immediately after a successful RESCHEDULE
 * (see interview.controller.ts) — NEVER throws, and never rolls back the
 * already-committed local reschedule; a provider failure here only ever
 * shows up as calendar_sync_status: "failed" on the returned Interview.
 * If there is no linked event at all, this is a pure no-op (current
 * behavior is unchanged for an unlinked Interview).
 */
export async function bestEffortSyncAfterReschedule(interview: InterviewDoc): Promise<InterviewDoc> {
  if (!interview.calendar_event_id || !interview.calendar_owner_user_id) {
    return interview;
  }

  const ownerUserId = interview.calendar_owner_user_id.toString();
  const connection = await getActiveConnection(ownerUserId);
  if (!connection) {
    await markSyncFailed(interview.id, "authorization_required");
    return (await Interview.findById(interview.id))!;
  }
  if (!connection.calendar_permission_granted) {
    await markSyncFailed(interview.id, "authorization_required");
    return (await Interview.findById(interview.id))!;
  }
  const refreshToken = decryptConnectionRefreshToken(connection);

  try {
    const attendeeEmails = await resolveAttendeeEmails(interview);
    const eventInput = await buildEventInput(interview, attendeeEmails);
    const result = await googleCalendarProvider.updateEvent(refreshToken, interview.calendar_event_id, eventInput);
    return await applySyncSuccess(interview.id, ownerUserId, result);
  } catch (err) {
    const mapped = toProviderError(err);
    await markSyncFailed(interview.id, mapped.code);
    logSafeProviderFailure(interview.id, "reschedule-sync", mapped);
    return (await Interview.findById(interview.id))!;
  }
}

/**
 * Same "never throws, never undoes the local business action" contract
 * as bestEffortSyncAfterReschedule, called after a successful CANCEL.
 * Cancellation sync is deliberately allowed to run even when the
 * Interview's Job has been soft-deleted (cancelInterview() itself already
 * permits this) — provider cleanup should remain possible whenever local
 * cancellation is.
 */
export async function bestEffortSyncAfterCancel(interview: InterviewDoc): Promise<InterviewDoc> {
  if (!interview.calendar_event_id || !interview.calendar_owner_user_id) {
    return interview;
  }

  const ownerUserId = interview.calendar_owner_user_id.toString();
  const connection = await getActiveConnection(ownerUserId);
  if (!connection) {
    await markSyncFailed(interview.id, "authorization_required");
    return (await Interview.findById(interview.id))!;
  }
  if (!connection.calendar_permission_granted) {
    await markSyncFailed(interview.id, "authorization_required");
    return (await Interview.findById(interview.id))!;
  }
  const refreshToken = decryptConnectionRefreshToken(connection);

  try {
    await googleCalendarProvider.cancelEvent(refreshToken, interview.calendar_event_id);
    const updated = await Interview.findByIdAndUpdate(
      interview.id,
      { $set: { calendar_sync_status: "synced", calendar_sync_error_code: null, calendar_last_synced_at: new Date() } },
      { new: true }
    );
    return updated!;
  } catch (err) {
    const mapped = toProviderError(err);
    await markSyncFailed(interview.id, mapped.code);
    logSafeProviderFailure(interview.id, "cancel-sync", mapped);
    return (await Interview.findById(interview.id))!;
  }
}
