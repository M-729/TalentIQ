import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { HiringStepTypeBadge } from "@/components/hiringPipeline/HiringStepTypeBadge";
import type { HiringStep } from "@/types/hiringStep";

export interface HiringStepCardProps {
  step: HiringStep;
  displayPosition: number;
  isFirst: boolean;
  isLast: boolean;
  /** True while ANY pipeline mutation for this job is in flight — prevents overlapping create/edit/delete/reorder actions. */
  disabled: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function HiringStepCard({
  step,
  displayPosition,
  isFirst,
  isLast,
  disabled,
  onMoveUp,
  onMoveDown,
  onEdit,
  onDelete,
}: HiringStepCardProps) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 py-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <span
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
            aria-hidden="true"
          >
            {displayPosition}
          </span>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-medium text-foreground">{step.name}</h3>
              <HiringStepTypeBadge type={step.type} />
            </div>
            {step.description && <p className="text-sm text-muted-foreground">{step.description}</p>}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Move ${step.name} up`}
            disabled={disabled || isFirst}
            onClick={onMoveUp}
          >
            <ArrowUp className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={`Move ${step.name} down`}
            disabled={disabled || isLast}
            onClick={onMoveDown}
          >
            <ArrowDown className="size-4" aria-hidden="true" />
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={onEdit}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={disabled}
            onClick={onDelete}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
