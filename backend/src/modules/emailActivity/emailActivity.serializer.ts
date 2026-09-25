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
  // Opaque, URL-facing identifier for THIS row's own underlying document
  // (the EmailNotification when source is "email_notification", or the
  // CompanyInvitation when source is "company_invitation") — used for
  // retry/resend actions (notif_.../retry, invite_.../resend). See
  // EmailNotification.model.ts's/CompanyInvitation.model.ts's own
  // public_id doc comment.
  public_id?: string;
  source: "email_notification" | "company_invitation";
  type: EmailActivityType;
  type_label: string;
  recipient_email: string;
  status: EmailNotificationStatus;
  sent_at: string | null;
  updated_at: string;
  related_label: string;
  related_application_id?: string;
  /** Opaque, URL-facing identifier for the related Application — see ApplicationListRowDTO.public_id. */
  related_application_public_id?: string;
  related_interview_id?: string;
  /** Opaque, URL-facing identifier for the related Interview — see InterviewDTO.public_id. */
  related_interview_public_id?: string;
  related_offer_id?: string;
  /** Opaque, URL-facing identifier for the related Offer — see OfferDTO.public_id. */
  related_offer_public_id?: string;
  related_assessment_id?: string;
  /** Opaque, URL-facing identifier for the related ApplicationAssessment — see ApplicationAssessmentDTO.public_id. */
  related_assessment_public_id?: string;
  related_invitation_id?: string;
  /** Opaque, URL-facing identifier for the related CompanyInvitation — same value as this row's own public_id when source is "company_invitation". */
  related_invitation_public_id?: string;
}

export interface EmailActivityListDTO {
  emails: EmailActivityRowDTO[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}
