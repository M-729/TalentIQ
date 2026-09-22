import { useState } from "react";
import { Check, Copy, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InterviewCalendar, InterviewStatus } from "@/types/interview";

/**
 * The single rule for whether an active Join Meet action should render —
 * used everywhere JoinMeetLink is rendered (InterviewsTable, Interview
 * detail via InterviewCalendarActions, ApplicationInterviewsSection) so
 * the rule can never drift between call sites. meeting_url is always
 * preserved in backend/history regardless of status — this only gates
 * the UI *action*, never the stored data.
 *
 * Copy Meet Link uses this exact same rule (see CopyMeetLinkButton below)
 * — a link that's no longer safe to join live is also no longer offered
 * as something to copy as an active meeting action; the URL itself is
 * never deleted, only the active-action affordance is withheld.
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

type CopyState = "idle" | "copied" | "failed";

// Secondary action alongside JoinMeetLink — always the exact persisted
// `url` it's given (same "never construct/guess a Meet URL" rule as
// JoinMeetLink above), copied via the browser Clipboard API. Clipboard
// access can be denied/unavailable (permissions, non-secure context); a
// failure never throws or shows a raw browser exception — it falls back
// to a safe, actionable message with the URL still visible/selectable so
// HR can copy it manually. Mirrors PublicJobLinkAction's established
// "button label temporarily changes" success pattern.
export function CopyMeetLinkButton({ url }: { url: string }) {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
        {copyState === "copied" ? (
          <Check className="size-4" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
        {copyState === "copied" ? "Meet link copied" : "Copy Meet Link"}
      </Button>
      {copyState === "failed" && (
        <p role="alert" className="text-xs text-destructive">
          Could not copy the Meet link. Please copy it manually: <span className="select-all">{url}</span>
        </p>
      )}
    </div>
  );
}
