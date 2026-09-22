import { useState } from "react";
import { AlertCircle, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewFeedbackForm } from "@/components/interviews/InterviewFeedbackForm";
import { RecommendationBadge } from "@/components/interviews/RecommendationBadge";
import { useInterviewFeedback } from "@/hooks/useInterviewFeedback";
import { formatDateTime } from "@/lib/formatDate";
import type { InterviewFeedbackRosterEntry } from "@/types/interviewFeedback";

export interface InterviewFeedbackSectionProps {
  interviewId: string;
}

function statusLabel(status: InterviewFeedbackRosterEntry["status"]): string {
  return status === "submitted" ? "Submitted" : "Awaiting feedback";
}

function FeedbackField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{value}</dd>
    </div>
  );
}

// Only completed Interviews ever have anything meaningful here — but this
// renders unconditionally whenever mounted; the caller (InterviewDetailPage)
// decides whether to mount it at all based on interview.status.
export function InterviewFeedbackSection({ interviewId }: InterviewFeedbackSectionProps) {
  const { data, isLoading, error, refetch } = useInterviewFeedback(interviewId);
  const [isFormOpen, setIsFormOpen] = useState(false);

  function handleSaved() {
    refetch();
  }

  const viewerActionLabel = (() => {
    if (!data) return null;
    if (!data.viewer.feedback) return "Add Feedback";
    return data.viewer.feedback.status === "submitted" ? "View Submitted Feedback" : "Continue Feedback";
  })();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interview Feedback</CardTitle>
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
        ) : data && data.interviewers.length > 0 ? (
          <div className="space-y-4">
            {data.viewer.assigned && (
              <Button type="button" size="sm" onClick={() => setIsFormOpen(true)}>
                <MessageSquareText aria-hidden="true" />
                {viewerActionLabel}
              </Button>
            )}

            <ul className="space-y-3">
              {data.interviewers.map((entry) => (
                <li key={entry.interviewer.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-foreground">{entry.interviewer.name}</span>
                    <span className="text-xs text-muted-foreground">{statusLabel(entry.status)}</span>
                  </div>

                  {entry.feedback && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <div className="flex flex-wrap items-center gap-2">
                        {entry.feedback.recommendation && <RecommendationBadge recommendation={entry.feedback.recommendation} />}
                        {entry.feedback.submitted_at && (
                          <span className="text-xs text-muted-foreground">Submitted {formatDateTime(entry.feedback.submitted_at)}</span>
                        )}
                      </div>
                      <dl className="space-y-2.5">
                        <FeedbackField label="Summary" value={entry.feedback.summary} />
                        <FeedbackField label="Strengths" value={entry.feedback.strengths} />
                        <FeedbackField label="Concerns" value={entry.feedback.concerns} />
                        <FeedbackField label="Private Notes" value={entry.feedback.private_notes} />
                      </dl>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No interviewers were assigned to this interview.</p>
        )}
      </CardContent>

      {data && (
        <InterviewFeedbackForm
          open={isFormOpen}
          onOpenChange={setIsFormOpen}
          interviewId={interviewId}
          ownFeedback={data.viewer.feedback}
          onSaved={handleSaved}
        />
      )}
    </Card>
  );
}
