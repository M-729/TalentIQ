import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-4 py-2">
      <p className="text-sm font-medium text-foreground">
        {selectedCount} candidate{selectedCount === 1 ? "" : "s"} selected
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
