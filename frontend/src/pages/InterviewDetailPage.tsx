import { useState } from "react";
import { AlertCircle, SearchX } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CancelInterviewDialog } from "@/components/interviews/CancelInterviewDialog";
import { InterviewCalendarActions } from "@/components/interviews/InterviewCalendarActions";
import { InterviewNotificationsSection } from "@/components/interviews/InterviewNotificationsSection";
import { InterviewStatusBadge } from "@/components/interviews/InterviewStatusBadge";
import { RescheduleInterviewDialog } from "@/components/interviews/RescheduleInterviewDialog";
import { useInterview } from "@/hooks/useInterview";
import { formatDateTime } from "@/lib/formatDate";
import type { Interview } from "@/types/interview";

function Field({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function InterviewDetailPage() {
  const { interviewId } = useParams<{ interviewId: string }>();
  const navigate = useNavigate();
  const { interview, applyUpdate, isLoading, error, notFound, refetch } = useInterview(interviewId);
  const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  if (!interviewId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <Skeleton className="h-9 w-64" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchX className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-foreground">This interview is unavailable.</p>
            <Button variant="outline" size="sm" onClick={() => navigate("/interviews")}>
              Back to Interviews
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <AlertCircle className="size-8 text-destructive" aria-hidden="true" />
            <div>
              <p className="font-medium text-foreground">Couldn't load this interview</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!interview) {
    return null;
  }

  // The mutation responses (reschedule/cancel/calendar actions) never
  // include candidate/job — applyUpdate merges them into the existing
  // detail state, preserving those immutable fields (see useInterview's
  // doc comment).
  function handleUpdated(updated: Interview) {
    applyUpdate(updated);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{interview.title}</h1>
            <InterviewStatusBadge status={interview.status} />
          </div>
          <p className="text-sm text-muted-foreground">{interview.stage.name}</p>
        </div>

        {interview.status === "scheduled" && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsRescheduleOpen(true)}>
              Reschedule
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setIsCancelOpen(true)}>
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Candidate</CardTitle>
          </CardHeader>
          <CardContent>
            {interview.candidate ? (
              <dl className="space-y-3">
                <Field label="Name" value={interview.candidate.name} />
                <Field label="Email" value={interview.candidate.email} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Candidate information is unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Job</CardTitle>
          </CardHeader>
          <CardContent>
            {interview.job ? (
              <dl className="space-y-3">
                <Field label="Title" value={interview.job.title} />
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">Job information is unavailable.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Schedule</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Field label="Date & time" value={formatDateTime(interview.starts_at)} />
              <Field label="Ends" value={formatDateTime(interview.ends_at)} />
              <Field label="Timezone" value={interview.timezone} />
              <Field label="Scheduled by" value={interview.scheduled_by.name} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Interviewers</CardTitle>
          </CardHeader>
          <CardContent>
            {interview.interviewers.length > 0 ? (
              <ul className="space-y-2">
                {interview.interviewers.map((interviewer) => (
                  <li key={interviewer.id} className="text-sm">
                    <span className="text-foreground">{interviewer.name}</span>{" "}
                    <span className="text-muted-foreground">{interviewer.email}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No interviewers assigned.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {interview.cancellation && (
        <Card>
          <CardHeader>
            <CardTitle>Cancellation</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <Field label="Cancelled at" value={formatDateTime(interview.cancellation.cancelled_at)} />
              <Field label="Cancelled by" value={interview.cancellation.cancelled_by?.name} />
              <Field label="Reason" value={interview.cancellation.reason} />
            </dl>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Google Calendar</CardTitle>
        </CardHeader>
        <CardContent>
          <InterviewCalendarActions interview={interview} onUpdated={handleUpdated} />
        </CardContent>
      </Card>

      {/* Candidate email history is preserved and visible regardless of
          the Interview's current status — a cancelled/completed
          Interview still shows its past scheduled/rescheduled/cancelled
          notification attempts. */}
      <InterviewNotificationsSection interviewId={interview.id} />

      {interview.status === "cancelled" && (
        <p className="text-xs text-muted-foreground">
          This interview is cancelled and read-only. <Link to="/interviews">Back to Interviews</Link>
        </p>
      )}

      <RescheduleInterviewDialog
        open={isRescheduleOpen}
        onOpenChange={setIsRescheduleOpen}
        interview={interview}
        onRescheduled={handleUpdated}
      />
      <CancelInterviewDialog open={isCancelOpen} onOpenChange={setIsCancelOpen} interview={interview} onCancelled={handleUpdated} />
    </div>
  );
}
