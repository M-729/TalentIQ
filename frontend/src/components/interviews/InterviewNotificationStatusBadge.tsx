import { Badge } from "@/components/ui/badge";
import type { InterviewNotificationStatus } from "@/types/interviewNotification";

const STATUS_CONFIG: Record<InterviewNotificationStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
  pending: { label: "Sending…", variant: "warning" },
};

export function InterviewNotificationStatusBadge({ status }: { status: InterviewNotificationStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
