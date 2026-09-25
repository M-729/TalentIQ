import type { InterviewDoc } from "../../models/Interview.model";
import type { LatestNotificationSummary } from "./interviewNotification.service";
import type { FeedbackProgressSummary } from "./interviewFeedback.service";

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

export interface InterviewCompletionDTO {
  completed_at: string;
  completed_by: ActorDTO | null;
}

export interface FeedbackProgressDTO {
  submitted: number;
  total: number;
}

export interface InterviewCalendarDTO {
  provider: string;
  /** Whether the OWNER's Google connection is currently active — lets the frontend show "owner disconnected" safely without exposing OAuth details. */
  connected: boolean;
  sync_status: string;
  meeting_url: string | null;
  last_synced_at: string | null;
}

export interface LatestNotificationDTO {
  category: string;
  status: string;
}

export interface InterviewDTO {
  id: string;
  // Opaque, URL-facing identifier — absent only for an Interview created
  // before this field existed and not yet covered by the backfill script.
  public_id?: string;
  title: string;
  stage: { id: string; name: string; type: string };
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  interviewers: InterviewerDTO[];
  scheduled_by: ActorDTO;
  cancellation: InterviewCancellationDTO | null;
  /** null unless status is "completed" — see interview.service.ts's completeInterview. */
  completion: InterviewCompletionDTO | null;
  /** null when this Interview has no Google Calendar integration at all. */
  calendar: InterviewCalendarDTO | null;
  /** The most recent candidate email notification's category+status — null when none has ever been attempted. Full history lives at GET /interviews/:id/notifications. */
  latest_notification: LatestNotificationDTO | null;
  /** null unless status is "completed" — how many of the assigned interviewers have submitted feedback so far. Full records live at GET /interviews/:id/feedback. */
  feedback_progress: FeedbackProgressDTO | null;
  created_at: string;
  updated_at: string;
}

const UNKNOWN_USER_NAME = "Unknown";

function resolveActor(userMap: Map<string, UserRef>, userId: string): ActorDTO {
  const user = userMap.get(userId);
  return { id: userId, name: user?.name ?? UNKNOWN_USER_NAME };
}

function buildInterviewers(doc: InterviewDoc, userMap: Map<string, UserRef>): InterviewerDTO[] {
  return doc.interviewer_user_ids.map((id) => {
    const userId = id.toString();
    const user = userMap.get(userId);
    return { id: userId, name: user?.name ?? UNKNOWN_USER_NAME, email: user?.email ?? "" };
  });
}

/** Shared by serializeInterview and serializeInterviewListRow — the exact same "provider-neutral, owner-connection-derived" shape either way. */
function buildCalendarDTO(doc: InterviewDoc, ownerConnectedMap: Map<string, boolean>): InterviewCalendarDTO | null {
  if (!doc.calendar_provider) return null;
  return {
    provider: doc.calendar_provider,
    connected: doc.calendar_owner_user_id ? (ownerConnectedMap.get(doc.calendar_owner_user_id.toString()) ?? false) : false,
    sync_status: doc.calendar_sync_status,
    meeting_url: doc.meeting_url ?? null,
    last_synced_at: doc.calendar_last_synced_at ? doc.calendar_last_synced_at.toISOString() : null,
  };
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
  ownerConnectedMap: Map<string, boolean> = new Map(),
  latestNotificationMap: Map<string, LatestNotificationSummary> = new Map(),
  feedbackProgressMap: Map<string, FeedbackProgressSummary> = new Map()
): InterviewDTO {
  return {
    id: doc.id,
    public_id: doc.public_id ?? undefined,
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
    interviewers: buildInterviewers(doc, userMap),
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
    // Keyed on completed_at being present (not just status === "completed")
    // — completeInterview() always sets both together, but this stays
    // defensive against a document that reached "completed" status some
    // other way (direct test/data fixture, future migration) without that
    // metadata, rather than crashing the whole response for it.
    completion: doc.completed_at
      ? {
          completed_at: doc.completed_at.toISOString(),
          completed_by: doc.completed_by ? resolveActor(userMap, doc.completed_by.toString()) : null,
        }
      : null,
    calendar: buildCalendarDTO(doc, ownerConnectedMap),
    latest_notification: latestNotificationMap.get(doc.id) ?? null,
    feedback_progress: feedbackProgressMap.get(doc.id) ?? null,
    // Always set by Mongoose (timestamps: { createdAt: "created_at", ... })
    // — the schema-inferred type just doesn't capture that as non-optional.
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
  };
}

export function serializeInterviews(
  docs: InterviewDoc[],
  userMap: Map<string, UserRef>,
  ownerConnectedMap: Map<string, boolean> = new Map(),
  latestNotificationMap: Map<string, LatestNotificationSummary> = new Map(),
  feedbackProgressMap: Map<string, FeedbackProgressSummary> = new Map()
): InterviewDTO[] {
  return docs.map((doc) => serializeInterview(doc, userMap, ownerConnectedMap, latestNotificationMap, feedbackProgressMap));
}

export interface InterviewDetailDTO extends InterviewDTO {
  /** null only if the owning Application/Candidate could not be resolved (defensive — should not happen in practice). */
  candidate: CandidateRef | null;
  job: JobRef | null;
}

/**
 * The single-Interview detail endpoint's DTO — a superset of InterviewDTO
 * that also names the candidate/job, since GET /interviews/:interviewId is
 * reachable directly (e.g. from the company-wide /interviews list) without
 * the caller already being on that Application's own detail page. The
 * per-Application nested list (serializeInterview/serializeInterviews)
 * deliberately keeps omitting them — that context already has its own
 * Application detail page for candidate/job info.
 */
export function serializeInterviewDetail(
  doc: InterviewDoc,
  userMap: Map<string, UserRef>,
  candidate: CandidateRef | null,
  job: JobRef | null,
  ownerConnectedMap: Map<string, boolean> = new Map(),
  latestNotificationMap: Map<string, LatestNotificationSummary> = new Map(),
  feedbackProgressMap: Map<string, FeedbackProgressSummary> = new Map()
): InterviewDetailDTO {
  return {
    ...serializeInterview(doc, userMap, ownerConnectedMap, latestNotificationMap, feedbackProgressMap),
    candidate,
    job,
  };
}

export interface CandidateRef {
  id: string;
  name: string;
  email: string;
}

export interface JobRef {
  id: string;
  title: string;
}

export interface InterviewListRowDTO {
  id: string;
  // Opaque, URL-facing identifier — see InterviewDTO.public_id.
  public_id?: string;
  title: string;
  /** null only if the owning Application/Candidate could not be resolved (defensive — should not happen in practice). */
  candidate: CandidateRef | null;
  job: JobRef | null;
  stage: { id: string; name: string; type: string };
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: string;
  interviewers: InterviewerDTO[];
  completion: InterviewCompletionDTO | null;
  calendar: InterviewCalendarDTO | null;
  latest_notification: LatestNotificationDTO | null;
  feedback_progress: FeedbackProgressDTO | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewListRowContext {
  userMap: Map<string, UserRef>;
  /** Keyed by Interview.application_id — see interview.service.ts's listInterviewsForCompany. */
  candidateByApplicationId: Map<string, CandidateRef>;
  /** Keyed by Interview.job_id. */
  jobById: Map<string, JobRef>;
  ownerConnectedMap?: Map<string, boolean>;
  /** Keyed by Interview id — see interviewNotification.service.ts's batchLatestNotificationStatus. */
  latestNotificationMap?: Map<string, LatestNotificationSummary>;
  /** Keyed by Interview id — see interviewFeedback.service.ts's batchFeedbackProgress. */
  feedbackProgressMap?: Map<string, FeedbackProgressSummary>;
}

/**
 * The company-wide /interviews list row — richer than serializeInterview
 * (which is scoped to a single Application the caller already knows, so it
 * never needs to name the candidate/job). Same exclusions apply: no raw
 * Google event id, no calendar_owner_user_id, no company/internal fields.
 */
export function serializeInterviewListRow(doc: InterviewDoc, ctx: InterviewListRowContext): InterviewListRowDTO {
  return {
    id: doc.id,
    public_id: doc.public_id ?? undefined,
    title: doc.title,
    candidate: ctx.candidateByApplicationId.get(doc.application_id.toString()) ?? null,
    job: ctx.jobById.get(doc.job_id.toString()) ?? null,
    stage: {
      id: doc.hiring_step_id.toString(),
      name: doc.stage_snapshot.name,
      type: doc.stage_snapshot.type,
    },
    starts_at: doc.starts_at.toISOString(),
    ends_at: doc.ends_at.toISOString(),
    timezone: doc.timezone,
    status: doc.status,
    interviewers: buildInterviewers(doc, ctx.userMap),
    completion: doc.completed_at
      ? {
          completed_at: doc.completed_at.toISOString(),
          completed_by: doc.completed_by ? resolveActor(ctx.userMap, doc.completed_by.toString()) : null,
        }
      : null,
    calendar: buildCalendarDTO(doc, ctx.ownerConnectedMap ?? new Map()),
    latest_notification: (ctx.latestNotificationMap ?? new Map()).get(doc.id) ?? null,
    feedback_progress: (ctx.feedbackProgressMap ?? new Map()).get(doc.id) ?? null,
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
  };
}

export function serializeInterviewListRows(docs: InterviewDoc[], ctx: InterviewListRowContext): InterviewListRowDTO[] {
  return docs.map((doc) => serializeInterviewListRow(doc, ctx));
}
