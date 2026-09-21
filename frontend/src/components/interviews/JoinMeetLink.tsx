import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InterviewCalendar, InterviewStatus } from "@/types/interview";

/**
 * The single rule for whether an active Join Meet action should render —
 * used everywhere JoinMeetLink is rendered (InterviewsTable, Interview
 * detail via InterviewCalendarActions, ApplicationInterviewsSection) so
 * the rule can never drift between call sites. meeting_url is always
 * preserved in backend/history regardless of status — this only gates
 * the UI *action*, never the stored data.
 */
export function canJoinMeet(interview: { status: InterviewStatus; calendar: InterviewCalendar | null }): boolean {
  return interview.status === "scheduled" && !!interview.calendar?.meeting_url;
}

// The Meet URL always comes from the backend (real Google conference
// data) — this component only ever renders whatever string it's given,
// never constructs/guesses a meet.google.com URL itself.
export function JoinMeetLink({ url }: { url: string }) {
  return (
    <Button asChild size="sm">
      <a href={url} target="_blank" rel="noopener noreferrer">
        <Video className="size-4" aria-hidden="true" />
        Join Google Meet
      </a>
    </Button>
  );
}
