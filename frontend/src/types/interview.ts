import type { LatestNotificationSummary } from "@/types/interviewNotification";

// Mirrors backend src/modules/interviews/interview.serializer.ts and
// interview.validation.ts exactly.
export const INTERVIEW_STATUSES = ["scheduled", "cancelled", "completed"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const CALENDAR_SYNC_STATUSES = ["not_connected", "pending", "synced", "failed"] as const;
export type CalendarSyncStatus = (typeof CALENDAR_SYNC_STATUSES)[number];

export interface InterviewerRef {
  id: string;
  name: string;
  email: string;
}

export interface ActorRef {
  id: string;
  name: string;
}

export interface InterviewStage {
  id: string;
  name: string;
  type: string;
}

export interface InterviewCancellation {
  cancelled_at: string;
  cancelled_by: ActorRef | null;
  reason: string | null;
}

export interface InterviewCompletion {
  completed_at: string;
  completed_by: ActorRef | null;
}

export interface FeedbackProgress {
  submitted: number;
  total: number;
}

// null on the Interview itself means "no Google Calendar integration at
// all yet" — never confuse that with sync_status: "not_connected", which
// can't actually occur here (calendar is only ever non-null once a
// provider event exists).
export interface InterviewCalendar {
  provider: string;
  /** Whether the OWNING user's Google connection is currently active AND has the required Calendar permission. */
  connected: boolean;
  sync_status: CalendarSyncStatus;
  meeting_url: string | null;
  last_synced_at: string | null;
}

export interface Interview {
  id: string;
  title: string;
  stage: InterviewStage;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: InterviewStatus;
  interviewers: InterviewerRef[];
  scheduled_by: ActorRef;
  cancellation: InterviewCancellation | null;
  /** null unless status is "completed". */
  completion: InterviewCompletion | null;
  calendar: InterviewCalendar | null;
  /** The most recent candidate email notification's category+status — null when none has ever been attempted. Full history is fetched separately (see services/api/interviewNotifications.ts). */
  latest_notification: LatestNotificationSummary | null;
  /** null unless status is "completed" — how many assigned interviewers have submitted feedback. Full records are fetched separately (see services/api/interviewFeedback.ts). */
  feedback_progress: FeedbackProgress | null;
  created_at: string;
  updated_at: string;
}

// The single-Interview detail endpoint's response — a superset of
// Interview that also names the candidate/job (see backend
// interview.serializer.ts's serializeInterviewDetail doc comment). The
// per-Application nested list (Interview[] from listApplicationInterviews)
// deliberately omits them — that page already has its own candidate/job
// context.
export interface InterviewDetail extends Interview {
  candidate: { id: string; name: string; email: string } | null;
  job: { id: string; title: string } | null;
}

// The richer /interviews (company-wide) list row — adds candidate/job,
// which serializeInterview (scoped to one already-known Application)
// deliberately omits.
export interface InterviewListRow {
  id: string;
  title: string;
  candidate: { id: string; name: string; email: string } | null;
  job: { id: string; title: string } | null;
  stage: InterviewStage;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: InterviewStatus;
  interviewers: InterviewerRef[];
  completion: InterviewCompletion | null;
  calendar: InterviewCalendar | null;
  latest_notification: LatestNotificationSummary | null;
  feedback_progress: FeedbackProgress | null;
  created_at: string;
  updated_at: string;
}

// Mirrors interview.validation.ts's scheduleInterviewSchema — title/
// stage/job/company/status/scheduled_by/calendar fields are all
// backend-derived and never sent from here.
export interface ScheduleInterviewInput {
  title?: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  interviewer_user_ids: string[];
}

// Mirrors rescheduleInterviewSchema — title is deliberately absent (never
// changed by reschedule); interviewer_user_ids is optional.
export interface RescheduleInterviewInput {
  starts_at: string;
  ends_at: string;
  timezone: string;
  interviewer_user_ids?: string[];
}

export interface CancelInterviewInput {
  reason?: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListInterviewsFilters {
  status?: InterviewStatus;
  jobId?: string;
  when?: "upcoming" | "past";
  page?: number;
  limit?: number;
}
