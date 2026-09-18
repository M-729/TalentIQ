import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/job";

// active = success (clearly live/good). closed is an intentional end state,
// not an error, so it reads as muted/neutral rather than destructive red.
// draft uses the warning tone (attention-needed, not yet live) as suggested.
const STATUS_STYLES: Record<JobStatus, string> = {
  active: "bg-success/10 text-success",
  draft: "bg-warning/10 text-warning",
  closed: "bg-muted text-muted-foreground",
};

const STATUS_LABELS: Record<JobStatus, string> = {
  active: "Active",
  draft: "Draft",
  closed: "Closed",
};

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
