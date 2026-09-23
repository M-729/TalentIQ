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
  source: "email_notification" | "company_invitation";
  type: EmailActivityType;
  type_label: string;
  recipient_email: string;
  status: EmailActivityStatus;
  sent_at: string | null;
  updated_at: string;
  related_label: string;
  related_application_id?: string;
  related_interview_id?: string;
  related_offer_id?: string;
  related_assessment_id?: string;
  related_invitation_id?: string;
}

export interface ListEmailActivityFilters {
  search?: string;
  type?: EmailActivityType;
  status?: EmailActivityStatus;
  page: number;
  limit: number;
}
