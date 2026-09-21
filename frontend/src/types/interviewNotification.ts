// Mirrors backend src/modules/interviews/interviewNotification.serializer.ts
// exactly.
export const INTERVIEW_NOTIFICATION_CATEGORIES = [
  "interview_scheduled",
  "interview_rescheduled",
  "interview_cancelled",
] as const;
export type InterviewNotificationCategory = (typeof INTERVIEW_NOTIFICATION_CATEGORIES)[number];

export const INTERVIEW_NOTIFICATION_STATUSES = ["pending", "sent", "failed"] as const;
export type InterviewNotificationStatus = (typeof INTERVIEW_NOTIFICATION_STATUSES)[number];

export interface InterviewNotification {
  id: string;
  category: InterviewNotificationCategory;
  status: InterviewNotificationStatus;
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  /** A safe, provider-neutral code (e.g. "smtp_unavailable") — never a raw SMTP error. Null unless status is "failed". */
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}

/** The lightweight summary embedded on the Interview DTO itself — see types/interview.ts's `latest_notification` field. */
export interface LatestNotificationSummary {
  category: InterviewNotificationCategory;
  status: InterviewNotificationStatus;
}
