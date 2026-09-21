import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { InterviewCalendarBadge } from "@/components/interviews/InterviewCalendarBadge";
import { JoinMeetLink, canJoinMeet } from "@/components/interviews/JoinMeetLink";
import { useGoogleCalendarEventActions } from "@/hooks/useGoogleCalendarEventActions";
import { useGoogleCalendarStatus } from "@/hooks/useGoogleCalendarStatus";
import type { Interview } from "@/types/interview";

export interface InterviewCalendarActionsProps {
  interview: Interview;
  onUpdated: (interview: Interview) => void;
}

// Every action here is explicit — nothing in this component ever fires on
// mount. "Add to Google Calendar" only calls POST .../google-calendar when
// clicked; nothing here is called when the interview/detail page merely
// opens.
export function InterviewCalendarActions({ interview, onUpdated }: InterviewCalendarActionsProps) {
  const { status } = useGoogleCalendarStatus();
  const { createEvent, syncEvent, isSubmitting, error, clearError } = useGoogleCalendarEventActions();

  const isActionable = interview.status === "scheduled";
  const isReady = !!status?.connected && !!status.calendar_permission_granted;

  async function handleCreate() {
    clearError();
    const updated = await createEvent(interview.id);
    if (updated) onUpdated(updated);
  }

  async function handleSync() {
    clearError();
    const updated = await syncEvent(interview.id);
    if (updated) onUpdated(updated);
  }

  return (
    <div className="space-y-2">
      <InterviewCalendarBadge calendar={interview.calendar} />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{error}</p>
        </div>
      )}

      {isActionable && !interview.calendar && isReady && (
        <Button type="button" size="sm" variant="outline" onClick={() => void handleCreate()} disabled={isSubmitting}>
          {isSubmitting ? "Adding…" : "Add to Google Calendar"}
        </Button>
      )}

      {isActionable && !interview.calendar && !isReady && (
        <p className="text-sm text-muted-foreground">
          Connect Google Calendar to create interview events and Meet links.{" "}
          <Link to="/settings/integrations" className="font-medium text-primary underline underline-offset-2">
            Go to Settings
          </Link>
        </p>
      )}

      {interview.calendar && !interview.calendar.connected && (
        <p className="text-xs text-muted-foreground">
          The connected Google account needs attention.{" "}
          <Link to="/settings/integrations" className="font-medium text-primary underline underline-offset-2">
            Check Settings
          </Link>
        </p>
      )}

      {isActionable && interview.calendar && (interview.calendar.sync_status === "pending" || interview.calendar.sync_status === "failed") && (
        <Button type="button" size="sm" variant="outline" onClick={() => void handleSync()} disabled={isSubmitting}>
          {isSubmitting ? "Syncing…" : "Sync Calendar"}
        </Button>
      )}

      {canJoinMeet(interview) && <JoinMeetLink url={interview.calendar!.meeting_url!} />}
    </div>
  );
}
