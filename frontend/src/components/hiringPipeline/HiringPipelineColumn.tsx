import type { ReactNode } from "react";
import { HiringPipelineApplicationCard } from "@/components/hiringPipeline/HiringPipelineApplicationCard";
import { Checkbox } from "@/components/ui/checkbox";
import type { HiringPipelineApplicationCard as ApplicationCardData } from "@/types/hiringPipelineBoard";
import type { HiringStepType } from "@/types/hiringStep";

export interface HiringPipelineColumnProps {
  title: string;
  helperText?: string;
  typeBadge?: ReactNode;
  count: number;
  applications: ApplicationCardData[];
  onMoveApplication: (application: ApplicationCardData) => void;
  /** The stage's own type — undefined for the virtual "New Applicants" column, which is never a real HiringStep. Only "interview" ever renders a Schedule Interview action on this column's cards. */
  stageType?: HiringStepType;
  onScheduleInterview?: (application: ApplicationCardData) => void;
  selectedIds: Set<string>;
  onToggleApplicationSelected: (applicationId: string) => void;
  /** Scoped strictly to THIS column's own currently-visible applications — never another Job or another column, and never a hidden/paginated page (this board has none). */
  onToggleSelectAll: (applicationIds: string[]) => void;
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
  stageType,
  onScheduleInterview,
  selectedIds,
  onToggleApplicationSelected,
  onToggleSelectAll,
}: HiringPipelineColumnProps) {
  const applicationIds = applications.map((application) => application.id);
  const selectedCount = applicationIds.filter((id) => selectedIds.has(id)).length;
  const allSelected = applicationIds.length > 0 && selectedCount === applicationIds.length;
  const someSelected = selectedCount > 0 && !allSelected;

  return (
    <div className="flex w-72 shrink-0 flex-col gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {applicationIds.length > 0 && (
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={() => onToggleSelectAll(applicationIds)}
              aria-label={`Select all in ${title}`}
            />
          )}
          <h3 className="flex-1 text-sm font-semibold text-foreground">{title}</h3>
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
              onScheduleInterview={
                stageType === "interview" && onScheduleInterview ? () => onScheduleInterview(application) : undefined
              }
              selected={selectedIds.has(application.id)}
              onToggleSelected={() => onToggleApplicationSelected(application.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
