import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Interview } from "@/types/interview";

/**
 * Whether the "scheduled interview time has ended" reminder should show —
 * a plain instant-vs-instant comparison against ends_at (the ISO timestamp
 * already represents the real instant; no manual timezone math is ever
 * needed here — see this ticket's explicit Part 20 rule). This is a
 * workflow REMINDER, never a status mutation: nothing here ever changes
 * interview.status on its own, and no polling/timer re-checks this against
 * the backend — it's a pure render-time comparison against `now`.
 */
export function isScheduledTimeEnded(interview: Pick<Interview, "status" | "ends_at">, now: Date = new Date()): boolean {
  return interview.status === "scheduled" && new Date(interview.ends_at).getTime() < now.getTime();
}

export interface InterviewTimeEndedNoticeProps {
  interview: Interview;
  onMarkCompletedClick: () => void;
}

export function InterviewTimeEndedNotice({ interview, onMarkCompletedClick }: InterviewTimeEndedNoticeProps) {
  if (!isScheduledTimeEnded(interview)) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 text-foreground">
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span>Scheduled interview time has ended.</span>
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onMarkCompletedClick}>
        Mark as Completed
      </Button>
    </div>
  );
}
