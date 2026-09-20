import { Button } from "@/components/ui/button";

export interface HiringPipelineBoardEmptyStateProps {
  onConfigurePipeline: () => void;
}

// Shown alongside the board (never hiding it) when a Job has zero
// configured HiringSteps — New Applicants still renders normally so HR
// can see that candidates exist even before a pipeline is built.
export function HiringPipelineBoardEmptyState({ onConfigurePipeline }: HiringPipelineBoardEmptyStateProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed border-border bg-muted/30 px-4 py-3">
      <p className="text-sm text-muted-foreground">No hiring stages are configured for this job yet.</p>
      <Button variant="outline" size="sm" onClick={onConfigurePipeline}>
        Configure Pipeline
      </Button>
    </div>
  );
}
