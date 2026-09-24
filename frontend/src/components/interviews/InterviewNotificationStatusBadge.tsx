import { Badge } from "@/components/ui/badge";
import { EMAIL_DELIVERY_STATUS_VARIANT } from "@/lib/emailDeliveryStatus";
import type { InterviewNotificationStatus } from "@/types/interviewNotification";

const STATUS_CONFIG: Record<InterviewNotificationStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  sent: { label: "Sent", variant: EMAIL_DELIVERY_STATUS_VARIANT.sent },
  failed: { label: "Failed", variant: EMAIL_DELIVERY_STATUS_VARIANT.failed },
  pending: { label: "Sending…", variant: EMAIL_DELIVERY_STATUS_VARIANT.pending },
};

export function InterviewNotificationStatusBadge({ status }: { status: InterviewNotificationStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
