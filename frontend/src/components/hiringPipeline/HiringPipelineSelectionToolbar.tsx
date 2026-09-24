import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MAX_BULK_MOVE_APPLICATIONS } from "@/lib/hiringPipelineLimits";

export interface HiringPipelineSelectionToolbarProps {
  selectedCount: number;
  onMoveSelected: () => void;
  onClearSelection: () => void;
}

// Renders nothing (zero vertical space) while nothing is selected — see
// Part 12 of the task: this must be easy to discover once candidates are
// selected, but must not permanently reserve layout space when idle.
export function HiringPipelineSelectionToolbar({
  selectedCount,
  onMoveSelected,
  onClearSelection,
}: HiringPipelineSelectionToolbarProps) {
  if (selectedCount === 0) return null;

  const exceedsMaxSelection = selectedCount > MAX_BULK_MOVE_APPLICATIONS;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-2">
      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {exceedsMaxSelection && <AlertCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />}
        {selectedCount} candidate{selectedCount === 1 ? "" : "s"} selected
        {/* Earliest possible warning — Move Selected still opens the
            dialog either way, which explains and blocks submission in
            detail; this is just a heads-up before that point. */}
        {exceedsMaxSelection && (
          <span className="font-normal text-destructive">(max {MAX_BULK_MOVE_APPLICATIONS} per move)</span>
        )}
      </p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onClearSelection}>
          Clear selection
        </Button>
        <Button type="button" size="sm" onClick={onMoveSelected}>
          Move selected
        </Button>
      </div>
    </div>
  );
}
