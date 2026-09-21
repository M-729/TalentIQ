import { Badge } from "@/components/ui/badge";
import type { InterviewStatus } from "@/types/interview";

const STATUS_CONFIG: Record<InterviewStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  scheduled: { label: "Scheduled", variant: "warning" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

export function InterviewStatusBadge({ status }: { status: InterviewStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
