import type { InterviewDoc } from "../../models/Interview.model";

export interface UserRef {
  id: string;
  name: string;
  email: string;
}

export interface InterviewerDTO {
  id: string;
  name: string;
  email: string;
}

export interface ActorDTO {
  id: string;
  name: string;
}

export interface InterviewCancellationDTO {
  cancelled_at: string;
  cancelled_by: ActorDTO | null;
  reason: string | null;
}

export interface InterviewCalendarDTO {
  provider: string;
  /** Whether the OWNER's Google connection is currently active — lets the frontend show "owner disconnected" safely without exposing OAuth details. */
  connected: boolean;
  sync_status: string;
  meeting_url: string | null;
  last_synced_at: string | null;
}

export interface InterviewDTO {
  id: string;
  title: string;
  stage: { id: string; name: string; type: string };
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  interviewers: InterviewerDTO[];
  scheduled_by: ActorDTO;
  cancellation: InterviewCancellationDTO | null;
  /** null when this Interview has no Google Calendar integration at all. */
  calendar: InterviewCalendarDTO | null;
  created_at: string;
  updated_at: string;
}

const UNKNOWN_USER_NAME = "Unknown";

function resolveActor(userMap: Map<string, UserRef>, userId: string): ActorDTO {
  const user = userMap.get(userId);
  return { id: userId, name: user?.name ?? UNKNOWN_USER_NAME };
}

/**
 * Explicit DTO — never a raw Mongoose document. `stage` is built from the
 * Interview's own stored stage_snapshot, never by re-resolving the live
 * HiringStep collection (a renamed/deleted HiringStep must not change
 * what a past Interview says it was scheduled under — see
 * Interview.model.ts). `userMap` is a small pre-fetched
 * id -> {name, email} lookup passed in by the caller (see
 * interview.service.ts's batchUserLookup) so a whole list of Interviews
 * resolves every interviewer/scheduler/canceller name in one query
 * instead of one per row.
 *
 * Deliberately excludes: password hashes, refresh/auth data, company
 * internals, __v, raw Mongoose internals, candidate PII (Application
 * detail already owns that context), the raw Google event id (backend-
 * internal — not yet genuinely useful to a client), and
 * calendar_owner_user_id (which User owns the provider connection is an
 * implementation detail; `calendar.connected` is the safe derived signal
 * a client actually needs).
 *
 * Interviewer entries include email (unlike scheduled_by/cancelled_by,
 * which only need {id, name}) — HR needs to know who is participating,
 * per this ticket's explicit instruction.
 */
export function serializeInterview(
  doc: InterviewDoc,
  userMap: Map<string, UserRef>,
  ownerConnectedMap: Map<string, boolean> = new Map()
): InterviewDTO {
  const interviewers: InterviewerDTO[] = doc.interviewer_user_ids.map((id) => {
    const userId = id.toString();
    const user = userMap.get(userId);
    return { id: userId, name: user?.name ?? UNKNOWN_USER_NAME, email: user?.email ?? "" };
  });

  return {
    id: doc.id,
    title: doc.title,
    stage: {
      id: doc.hiring_step_id.toString(),
      name: doc.stage_snapshot.name,
      type: doc.stage_snapshot.type,
    },
    starts_at: doc.starts_at.toISOString(),
    ends_at: doc.ends_at.toISOString(),
    timezone: doc.timezone,
    status: doc.status,
    interviewers,
    scheduled_by: resolveActor(userMap, doc.scheduled_by.toString()),
    cancellation:
      doc.status === "cancelled"
        ? {
            // Always set together with status "cancelled" by
            // cancelInterview() — non-null assertion reflects that
            // invariant, not an assumption about untouched data.
            cancelled_at: doc.cancelled_at!.toISOString(),
            cancelled_by: doc.cancelled_by ? resolveActor(userMap, doc.cancelled_by.toString()) : null,
            reason: doc.cancellation_reason ?? null,
          }
        : null,
    calendar: doc.calendar_provider
      ? {
          provider: doc.calendar_provider,
          connected: doc.calendar_owner_user_id ? (ownerConnectedMap.get(doc.calendar_owner_user_id.toString()) ?? false) : false,
          sync_status: doc.calendar_sync_status,
          meeting_url: doc.meeting_url ?? null,
          last_synced_at: doc.calendar_last_synced_at ? doc.calendar_last_synced_at.toISOString() : null,
        }
      : null,
    // Always set by Mongoose (timestamps: { createdAt: "created_at", ... })
    // — the schema-inferred type just doesn't capture that as non-optional.
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
  };
}

export function serializeInterviews(
  docs: InterviewDoc[],
  userMap: Map<string, UserRef>,
  ownerConnectedMap: Map<string, boolean> = new Map()
): InterviewDTO[] {
  return docs.map((doc) => serializeInterview(doc, userMap, ownerConnectedMap));
}
