// Mirrors backend/src/modules/rejection/rejection.serializer.ts exactly.
export interface RejectionInfo {
  rejected_at: string | null;
  rejected_by: { id: string; name: string } | null;
  rejection_reason: string | null;
  email_status: "pending" | "sent" | "failed" | null;
}

export interface RejectApplicationInput {
  send_email: boolean;
  internal_reason?: string | null;
}

export interface RejectionNotification {
  id: string;
  status: "pending" | "sent" | "failed";
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}
