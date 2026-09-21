import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { InterviewNotificationStatusBadge } from "@/components/interviews/InterviewNotificationStatusBadge";
import { useInterviewNotifications } from "@/hooks/useInterviewNotifications";
import { useRetryInterviewNotification } from "@/hooks/useRetryInterviewNotification";
import { formatDateTime } from "@/lib/formatDate";
import type { InterviewNotificationCategory } from "@/types/interviewNotification";

const CATEGORY_LABELS: Record<InterviewNotificationCategory, string> = {
  interview_scheduled: "Scheduled notification",
  interview_rescheduled: "Rescheduled notification",
  interview_cancelled: "Cancelled notification",
};

export interface InterviewNotificationsSectionProps {
  interviewId: string;
}

// Compact by design — a list of category + status + timestamp rows, never
// a giant card, matching this ticket's explicit instruction. Full delivery
// history/audit for candidate-facing emails; the future /emails page can
// reuse the same underlying records.
export function InterviewNotificationsSection({ interviewId }: InterviewNotificationsSectionProps) {
  const { notifications, isLoading, error, refetch } = useInterviewNotifications(interviewId);
  const { run, isSubmitting, error: retryError, clearError } = useRetryInterviewNotification();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  async function handleRetry(notificationId: string) {
    clearError();
    setRetryingId(notificationId);
    const updated = await run(notificationId);
    setRetryingId(null);
    if (updated) refetch();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Candidate Notification</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
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
        ) : notifications && notifications.length > 0 ? (
          <ul className="divide-y divide-border">
            {notifications.map((notification) => {
              const timestampLabel = notification.sent_at ?? notification.attempted_at ?? notification.created_at;
              const isRetryingThis = isSubmitting && retryingId === notification.id;
              return (
                <li key={notification.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{CATEGORY_LABELS[notification.category]}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(timestampLabel)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <InterviewNotificationStatusBadge status={notification.status} />
                    {notification.status === "failed" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isRetryingThis}
                        onClick={() => void handleRetry(notification.id)}
                      >
                        {isRetryingThis ? "Retrying…" : "Retry Email"}
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No candidate notifications yet.</p>
        )}

        {retryError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p role="alert">{retryError}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
