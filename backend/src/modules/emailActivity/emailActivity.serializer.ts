import type { EmailNotificationStatus } from "../../models/EmailNotification.model";
import type { EmailActivityType } from "./emailActivity.validation";

const TYPE_LABELS: Record<EmailActivityType, string> = {
  interview_scheduled: "Interview Scheduled",
  interview_rescheduled: "Interview Rescheduled",
  interview_cancelled: "Interview Cancelled",
  assessment_invitation: "Assessment Invitation",
  application_rejection: "Application Rejection",
  offer_sent: "Offer",
  company_invitation: "Company Invitation",
};

export function emailActivityTypeLabel(type: EmailActivityType): string {
  return TYPE_LABELS[type];
}

/**
 * One unified, read-only row — never a full raw EmailNotification/
 * CompanyInvitation document. No snapshots, no provider errors, no
 * tokens, nothing beyond what HR already legitimately sees elsewhere in
 * the product (see this ticket's explicit Part 6/9 "do not expose
 * internal snapshots/tokens" rule).
 */
export interface EmailActivityRowDTO {
  id: string;
  source: "email_notification" | "company_invitation";
  type: EmailActivityType;
  type_label: string;
  recipient_email: string;
  status: EmailNotificationStatus;
  sent_at: string | null;
  updated_at: string;
  related_label: string;
  related_application_id?: string;
  related_interview_id?: string;
  related_offer_id?: string;
  related_assessment_id?: string;
  related_invitation_id?: string;
}

export interface EmailActivityListDTO {
  emails: EmailActivityRowDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
