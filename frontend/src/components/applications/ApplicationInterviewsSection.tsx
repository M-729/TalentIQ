import { useState } from "react";
import { AlertCircle, CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewCalendarBadge } from "@/components/interviews/InterviewCalendarBadge";
import { InterviewStatusBadge } from "@/components/interviews/InterviewStatusBadge";
import { JoinMeetLink, canJoinMeet } from "@/components/interviews/JoinMeetLink";
import { ScheduleInterviewDialog } from "@/components/interviews/ScheduleInterviewDialog";
import { useApplicationInterviews } from "@/hooks/useApplicationInterviews";
import { formatDateTime } from "@/lib/formatDate";
import type { ApplicationDetail } from "@/types/application";
import type { LatestNotificationSummary } from "@/types/interviewNotification";

export interface ApplicationInterviewsSectionProps {
  application: ApplicationDetail;
}

// Compact wording only — full history lives on Interview Detail (and,
// eventually, /emails). Never rendered as a giant card here.
function notificationStatusLabel(latestNotification: LatestNotificationSummary | null): string | null {
  if (!latestNotification) return null;
  switch (latestNotification.status) {
    case "sent":
      return "Email sent";
    case "failed":
      return "Email needs attention";
    case "pending":
      return "Email sending…";
  }
}

// Scheduling here is always an explicit HR click on "Schedule Interview"
// — entering an interview-type stage never opens this dialog on its own
// (that transition happens entirely through the separate Move action).
export function ApplicationInterviewsSection({ application }: ApplicationInterviewsSectionProps) {
  const { interviews, isLoading, error, refetch } = useApplicationInterviews(application.id);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);

  const isInterviewStage = application.status === "in_process" && application.current_step?.type === "interview";
  const activeInterviewForCurrentStage =
    isInterviewStage && interviews
      ? (interviews.find((interview) => interview.stage.id === application.current_step!.id && interview.status === "scheduled") ??
        null)
      : null;

  // The frontend guard mirrors the backend's own duplicate-active-interview
  // protection — it never replaces it. Even if this check were somehow
  // bypassed, the backend's partial unique index still rejects a second
  // active Interview for the same Application + HiringStep.
  const canScheduleNew = isInterviewStage && !activeInterviewForCurrentStage;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Interviews</CardTitle>
        {canScheduleNew && (
          <Button size="sm" onClick={() => setIsScheduleOpen(true)}>
            Schedule Interview
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p role="alert">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                Retry
              </Button>
            </div>
          </div>
        ) : interviews && interviews.length > 0 ? (
          <ul className="space-y-3">
            {interviews.map((interview) => (
              <li key={interview.id} className="rounded-md border border-border p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link to={`/interviews/${interview.id}`} className="font-medium text-foreground hover:underline">
                      {interview.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">{interview.stage.name}</p>
                  </div>
                  <InterviewStatusBadge status={interview.status} />
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(interview.starts_at)}</p>
                {interview.interviewers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Interviewer(s): {interview.interviewers.map((interviewer) => interviewer.name).join(", ")}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <InterviewCalendarBadge calendar={interview.calendar} />
                  {canJoinMeet(interview) && <JoinMeetLink url={interview.calendar!.meeting_url!} />}
                </div>
                {notificationStatusLabel(interview.latest_notification) && (
                  <p
                    className={`mt-1.5 text-xs ${interview.latest_notification?.status === "failed" ? "text-destructive" : "text-muted-foreground"}`}
                  >
                    {notificationStatusLabel(interview.latest_notification)}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <CalendarDays className="size-6 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No interviews have been scheduled for this application.</p>
          </div>
        )}
      </CardContent>

      {isInterviewStage && application.current_step && (
        <ScheduleInterviewDialog
          open={isScheduleOpen}
          onOpenChange={setIsScheduleOpen}
          applicationId={application.id}
          defaultTitle={application.current_step.name}
          onScheduled={() => {
            setIsScheduleOpen(false);
            refetch();
          }}
        />
      )}
    </Card>
  );
}
