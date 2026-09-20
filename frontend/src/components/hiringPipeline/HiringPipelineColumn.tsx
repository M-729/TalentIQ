import type { ReactNode } from "react";
import { HiringPipelineApplicationCard } from "@/components/hiringPipeline/HiringPipelineApplicationCard";
import type { HiringPipelineApplicationCard as ApplicationCardData } from "@/types/hiringPipelineBoard";

export interface HiringPipelineColumnProps {
  title: string;
  helperText?: string;
  typeBadge?: ReactNode;
  count: number;
  applications: ApplicationCardData[];
  onMoveApplication: (application: ApplicationCardData) => void;
}

// A fixed, sensible min width per column (not compressed to fit many
// stages) inside a horizontally scrolling board wrapper — see
// HiringPipelineBoard.tsx for the overflow-x-auto wrapper this column
// relies on.
export function HiringPipelineColumn({
  title,
  helperText,
  typeBadge,
  count,
  applications,
  onMoveApplication,
}: HiringPipelineColumnProps) {
  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="text-xs font-medium text-muted-foreground">{count}</span>
        </div>
        {typeBadge}
        {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
      </div>

      <div className="flex flex-col gap-3">
        {applications.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
            No applicants in this stage.
          </p>
        ) : (
          applications.map((application) => (
            <HiringPipelineApplicationCard
              key={application.id}
              application={application}
              onMove={() => onMoveApplication(application)}
            />
          ))
        )}
      </div>
    </div>
  );
}
