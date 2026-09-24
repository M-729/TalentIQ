/**
 * Single source of truth for the color a "did this outbound email deliver"
 * badge gets. Every screen that surfaces this concept (assessments,
 * interview notifications, email activity, team invitations) previously
 * kept its own copy of this mapping and had drifted: "pending" rendered as
 * warning in some, neutral in others. Callers still choose their own label
 * text (e.g. "Sending…" vs "Pending") — only the color is unified here.
 */
export type EmailDeliveryStatus = "pending" | "sent" | "failed";

export const EMAIL_DELIVERY_STATUS_VARIANT: Record<EmailDeliveryStatus, "warning" | "success" | "destructive"> = {
  pending: "warning",
  sent: "success",
  failed: "destructive",
};
