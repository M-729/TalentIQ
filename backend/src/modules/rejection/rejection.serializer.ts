import type { ApplicationDoc } from "../../models/Application.model";
import type { EmailNotificationDoc, EmailNotificationStatus } from "../../models/EmailNotification.model";

export interface RejectionNotificationDTO {
  id: string;
  status: EmailNotificationStatus;
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
 * Mirrors interviewNotification.serializer.ts's serializeInterviewNotification
 * / applicationAssessment.serializer.ts's serializeAssessmentNotification
 * exactly, for the application_rejection category — same established
 * per-category-family duplication convention (each notification family
 * gets its own small serializer) rather than a shared generic one.
 */
export function serializeRejectionNotification(doc: EmailNotificationDoc): RejectionNotificationDTO {
  return {
    id: doc.id,
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

export interface RejectionInfoDTO {
  rejected_at: string | null;
  rejected_by: { id: string; name: string } | null;
  // HR-only context — this endpoint is authenticated HR/Admin-only (see
  // rejection.routes.ts), never candidate-facing, so this is safe to
  // return here even though it must never reach the candidate email (see
  // Application.model.ts's rejection_reason doc comment).
  rejection_reason: string | null;
  // The most recent application_rejection notification's status — null
  // when HR chose not to send an email at all.
  email_status: EmailNotificationStatus | null;
}

/**
 * Explicit DTO — never a raw Mongoose document. `rejectedByName` is
 * resolved by the caller (a plain User lookup, same pattern as
 * stageTransition.service.ts's movedByName) so this serializer never needs
 * its own User query.
 */
export function serializeRejectionInfo(
  application: ApplicationDoc,
  rejectedByName: string | null,
  emailStatus: EmailNotificationStatus | null
): RejectionInfoDTO {
  return {
    rejected_at: application.rejected_at ? application.rejected_at.toISOString() : null,
    rejected_by: application.rejected_by_user_id
      ? { id: application.rejected_by_user_id.toString(), name: rejectedByName ?? "Unknown" }
      : null,
    rejection_reason: application.rejection_reason ?? null,
    email_status: emailStatus,
  };
}
