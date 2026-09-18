import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types/job";

// Matches the approved wireframe exactly (TalentIQ_UI_Design_Wireframes.pdf,
// Jobs listing): active = success green, draft = neutral gray, closed =
// destructive red. This corrects an earlier assumption (draft=warning,
// closed=muted) made before the wireframe was available.
const STATUS_STYLES: Record<JobStatus, string> = {
  active: "bg-success/10 text-success",
  draft: "bg-muted text-muted-foreground",
  closed: "bg-destructive/10 text-destructive",
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
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        STATUS_STYLES[status]
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
