import { Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface HiringPipelineBoardEmptyStateProps {
  onConfigurePipeline: () => void;
}

// Shown alongside the board (never hiding it) when a Job has zero
// configured HiringSteps — New Applicants still renders normally so HR
// can see that candidates exist even before a pipeline is built.
export function HiringPipelineBoardEmptyState({ onConfigurePipeline }: HiringPipelineBoardEmptyStateProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3.5">
      <div className="flex items-center gap-2.5">
        <Workflow className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <p className="text-sm text-foreground">No hiring stages are configured for this job yet.</p>
      </div>
      <Button size="sm" onClick={onConfigurePipeline}>
        Configure Pipeline
      </Button>
    </div>
  );
}
