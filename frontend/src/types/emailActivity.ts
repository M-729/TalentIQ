export const EMAIL_ACTIVITY_TYPES = [
  "interview_scheduled",
  "interview_rescheduled",
  "interview_cancelled",
  "assessment_invitation",
  "application_rejection",
  "offer_sent",
  "company_invitation",
] as const;
export type EmailActivityType = (typeof EMAIL_ACTIVITY_TYPES)[number];

export const EMAIL_ACTIVITY_STATUSES = ["pending", "sent", "failed"] as const;
export type EmailActivityStatus = (typeof EMAIL_ACTIVITY_STATUSES)[number];

export interface EmailActivityRow {
  id: string;
  // Opaque, URL-safe identifier for THIS row's own underlying document —
  // used for retry/resend actions (notif_.../retry, invite_.../resend).
  public_id?: string;
  source: "email_notification" | "company_invitation";
  type: EmailActivityType;
  type_label: string;
  recipient_email: string;
  status: EmailActivityStatus;
  sent_at: string | null;
  updated_at: string;
  related_label: string;
  related_application_id?: string;
  // Opaque, URL-safe identifier for the related Application — see
  // types/application.ts's ApplicationListRow.public_id.
  related_application_public_id?: string;
  related_interview_id?: string;
  // Opaque, URL-safe identifier for the related Interview — see
  // types/interview.ts's Interview.public_id.
  related_interview_public_id?: string;
  related_offer_id?: string;
  // Opaque, URL-safe identifier for the related Offer — see types/offer.ts's Offer.public_id.
  related_offer_public_id?: string;
  related_assessment_id?: string;
  // Opaque, URL-safe identifier for the related ApplicationAssessment.
  related_assessment_public_id?: string;
  related_invitation_id?: string;
  // Opaque, URL-safe identifier for the related CompanyInvitation — same value as this row's own public_id when source is "company_invitation".
  related_invitation_public_id?: string;
}

export interface ListEmailActivityFilters {
  search?: string;
  type?: EmailActivityType;
  status?: EmailActivityStatus;
  page: number;
  limit: number;
}
