import type { EmailNotificationDoc } from "../../models/EmailNotification.model";

export interface InterviewNotificationDTO {
  id: string;
  category: string;
  status: string;
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  /** A safe, provider-neutral code (e.g. "smtp_unavailable") — never a raw SMTP/Nodemailer error. Null unless status is "failed". */
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}

/**
 * Explicit DTO — never a raw Mongoose document. Deliberately excludes:
 * company_id/application_id/candidate_id/interview_id (internal
 * relational ids not yet useful to a client), triggered_by_user_id, __v,
 * and the raw rendered email body (never stored in the first place — see
 * EmailNotification.model.ts's own doc comment).
 */
export function serializeInterviewNotification(doc: EmailNotificationDoc): InterviewNotificationDTO {
  return {
    id: doc.id,
    category: doc.category,
    status: doc.status,
    subject: doc.subject,
    recipient_email: doc.recipient_email,
    attempted_at: doc.attempted_at ? doc.attempted_at.toISOString() : null,
    sent_at: doc.sent_at ? doc.sent_at.toISOString() : null,
    failure_code: doc.failure_code ?? null,
    attempt_count: doc.attempt_count,
    created_at: doc.created_at!.toISOString(),
  };
}

export function serializeInterviewNotifications(docs: EmailNotificationDoc[]): InterviewNotificationDTO[] {
  return docs.map(serializeInterviewNotification);
}
