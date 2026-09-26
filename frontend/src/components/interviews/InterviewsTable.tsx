import { Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InterviewCalendarBadge } from "@/components/interviews/InterviewCalendarBadge";
import { InterviewStatusBadge } from "@/components/interviews/InterviewStatusBadge";
import { JoinMeetLink, canJoinMeet } from "@/components/interviews/JoinMeetLink";
import { formatDateTime } from "@/lib/formatDate";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { InterviewListRow } from "@/types/interview";

const AVATAR_TONES = [
  "bg-violet-100 text-violet-700",
  "bg-blue-100 text-blue-700",
  "bg-rose-100 text-rose-700",
  "bg-amber-100 text-amber-700",
  "bg-emerald-100 text-emerald-700",
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// A stable per-row tint keyed off the row's own id (never index-based, so a
// row's color never shifts as other rows are added/removed/paginated) —
// purely decorative, no meaning attached to the color itself. Matches
// ApplicationsTable.tsx/AssessmentsTable.tsx's own avatarTone exactly, for a
// consistent look across all three list pages.
function avatarTone(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

// Professional, compact SaaS density — a plain table, matching
// ApplicationsTable.tsx/JobsTable.tsx exactly, never a grid of large
// rounded cards.
export function InterviewsTable({ interviews }: { interviews: InterviewListRow[] }) {
  return (
    <Card className="overflow-hidden rounded-xl border-border p-0 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-3.5">
                Candidate
              </th>
              <th scope="col" className="px-4 py-3.5">
                Job
              </th>
              <th scope="col" className="px-4 py-3.5">
                Interview
              </th>
              <th scope="col" className="px-4 py-3.5">
                Stage
              </th>
              <th scope="col" className="px-4 py-3.5">
                Date &amp; Time
              </th>
              <th scope="col" className="px-4 py-3.5">
                Interviewers
              </th>
              <th scope="col" className="px-4 py-3.5">
                Status
              </th>
              <th scope="col" className="px-4 py-3.5">
                Calendar
              </th>
              <th scope="col" className="px-4 py-3.5 pr-5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((interview) => (
              <tr key={interview.id} className="border-b border-border last:border-0 hover:bg-primary/5">
                <td className="px-5 py-3.5">
                  {interview.candidate ? (
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarTone(interview.id)}`}
                      >
                        {getInitials(interview.candidate.name)}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground">{interview.candidate.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{interview.candidate.email}</div>
                      </div>
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5 font-medium text-foreground">{interview.job?.title ?? "—"}</td>
                <td className="px-4 py-3.5 text-foreground">{interview.title}</td>
                <td className="px-4 py-3.5">
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {interview.stage.name}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-sm text-muted-foreground">{formatDateTime(interview.starts_at)}</span>
                </td>
                <td className="px-4 py-3.5">
                  {interview.interviewers.length > 0 ? (
                    <div className="text-sm text-foreground">
                      {interview.interviewers.map((interviewer) => interviewer.name).join(", ")}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3.5">
                  <div className="space-y-1">
                    <InterviewStatusBadge status={interview.status} />
                    {interview.status === "completed" && interview.feedback_progress && (
                      <p className="text-xs text-muted-foreground">
                        Feedback {interview.feedback_progress.submitted}/{interview.feedback_progress.total}
                      </p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex flex-col items-start gap-1.5">
                    <InterviewCalendarBadge calendar={interview.calendar} />
                    {canJoinMeet(interview) && <JoinMeetLink url={interview.calendar!.meeting_url!} />}
                  </div>
                </td>
                <td className="px-4 py-3.5 pr-5 text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-primary/30 text-primary hover:bg-primary/5 hover:text-primary"
                    asChild
                  >
                    <Link to={`/interviews/${resourceUrlId(interview)}`}>
                      <Eye className="size-3.5" aria-hidden="true" />
                      View
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
