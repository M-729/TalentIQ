import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InterviewCalendarBadge } from "@/components/interviews/InterviewCalendarBadge";
import { InterviewStatusBadge } from "@/components/interviews/InterviewStatusBadge";
import { JoinMeetLink, canJoinMeet } from "@/components/interviews/JoinMeetLink";
import { formatDateTime } from "@/lib/formatDate";
import type { InterviewListRow } from "@/types/interview";

// Professional, compact SaaS density — a plain table, matching
// ApplicationsTable.tsx/JobsTable.tsx exactly, never a grid of large
// rounded cards.
export function InterviewsTable({ interviews }: { interviews: InterviewListRow[] }) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground">
              <th scope="col" className="px-4 py-3">
                Candidate
              </th>
              <th scope="col" className="px-4 py-3">
                Job
              </th>
              <th scope="col" className="px-4 py-3">
                Interview
              </th>
              <th scope="col" className="px-4 py-3">
                Stage
              </th>
              <th scope="col" className="px-4 py-3">
                Date &amp; Time
              </th>
              <th scope="col" className="px-4 py-3">
                Interviewers
              </th>
              <th scope="col" className="px-4 py-3">
                Status
              </th>
              <th scope="col" className="px-4 py-3">
                Calendar
              </th>
              <th scope="col" className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {interviews.map((interview) => (
              <tr key={interview.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                <td className="px-4 py-3">
                  {interview.candidate ? (
                    <>
                      <div className="font-medium text-foreground">{interview.candidate.name}</div>
                      <div className="text-xs text-muted-foreground">{interview.candidate.email}</div>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-foreground">{interview.job?.title ?? "—"}</td>
                <td className="px-4 py-3 text-foreground">{interview.title}</td>
                <td className="px-4 py-3 text-muted-foreground">{interview.stage.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{formatDateTime(interview.starts_at)}</td>
                <td className="px-4 py-3">
                  {interview.interviewers.length > 0 ? (
                    <div className="text-foreground">
                      {interview.interviewers.map((interviewer) => interviewer.name).join(", ")}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <InterviewStatusBadge status={interview.status} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-start gap-1.5">
                    <InterviewCalendarBadge calendar={interview.calendar} />
                    {canJoinMeet(interview) && <JoinMeetLink url={interview.calendar!.meeting_url!} />}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/interviews/${interview.id}`}>View</Link>
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
