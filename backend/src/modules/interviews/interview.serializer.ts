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
 * detail already owns that context), and the reserved
 * calendar_provider/calendar_event_id/meeting_url fields (unused by this
 * ticket, and not yet meaningful to expose).
 *
 * Interviewer entries include email (unlike scheduled_by/cancelled_by,
 * which only need {id, name}) — HR needs to know who is participating,
 * per this ticket's explicit instruction.
 */
export function serializeInterview(doc: InterviewDoc, userMap: Map<string, UserRef>): InterviewDTO {
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
    // Always set by Mongoose (timestamps: { createdAt: "created_at", ... })
    // — the schema-inferred type just doesn't capture that as non-optional.
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
  };
}

export function serializeInterviews(docs: InterviewDoc[], userMap: Map<string, UserRef>): InterviewDTO[] {
  return docs.map((doc) => serializeInterview(doc, userMap));
}
