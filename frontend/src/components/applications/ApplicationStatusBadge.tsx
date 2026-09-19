import { Badge } from "@/components/ui/badge";
import type { ApplicationStatus } from "@/types/application";

// A separate concept from AI screening status (see ScreeningStatusBadge) —
// this is the recruiter-controlled pipeline status, never conflated with
// whether/how well the CV was AI-screened.
const STATUS_CONFIG: Record<ApplicationStatus, { label: string; variant: "neutral" | "warning" | "destructive" | "success" }> = {
  applied: { label: "Applied", variant: "neutral" },
  in_process: { label: "In Process", variant: "warning" },
  rejected: { label: "Rejected", variant: "destructive" },
  offered: { label: "Offered", variant: "success" },
  hired: { label: "Hired", variant: "success" },
};

export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
