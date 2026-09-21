import { Skeleton } from "@/components/ui/skeleton";
import { useInterviewerCandidates } from "@/hooks/useInterviewerCandidates";

export interface InterviewerMultiSelectProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  error?: string;
  describedById?: string;
}

// No searchable/async combobox component exists anywhere in this codebase
// (see the "interviewer picker" gap this was built to fill) — a plain
// checkbox list is the simplest fully-accessible option without adding a
// new dependency. Only TalentIQ Users returned by GET /users (this
// company's own active Users) are ever selectable — there is no free-text
// email input, so an interview request can never carry an arbitrary
// attendee.
export function InterviewerMultiSelect({ selectedIds, onChange, disabled, error, describedById }: InterviewerMultiSelectProps) {
  const { interviewers, isLoading, error: loadError, refetch } = useInterviewerCandidates();

  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <p role="alert">{loadError}</p>
        <button type="button" className="mt-1 text-xs font-medium underline" onClick={refetch}>
          Try again
        </button>
      </div>
    );
  }

  if (!interviewers || interviewers.length === 0) {
    return <p className="text-sm text-muted-foreground">No active team members are available to interview yet.</p>;
  }

  return (
    <div
      role="group"
      aria-describedby={describedById}
      aria-invalid={!!error}
      className="max-h-48 space-y-1 overflow-y-auto rounded-md border border-input bg-background p-2"
    >
      {interviewers.map((interviewer) => (
        <label
          key={interviewer.id}
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-secondary"
        >
          <input
            type="checkbox"
            className="size-4 rounded border-input"
            checked={selectedIds.includes(interviewer.id)}
            onChange={() => toggle(interviewer.id)}
            disabled={disabled}
          />
          <span className="text-foreground">{interviewer.name}</span>
          <span className="text-xs text-muted-foreground">{interviewer.email}</span>
        </label>
      ))}
    </div>
  );
}
