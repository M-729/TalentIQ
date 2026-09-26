import { useState } from "react";
import { AlertCircle, Check, ClipboardCheck, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AssessmentFormDialog } from "@/components/applications/AssessmentFormDialog";
import { AssessmentHistorySection } from "@/components/applications/AssessmentHistorySection";
import { CopyAssessmentLinkButton } from "@/components/applications/CopyAssessmentLinkButton";
import { RecordAssessmentResultDialog } from "@/components/applications/RecordAssessmentResultDialog";
import { useApplicationAssessmentHistory } from "@/hooks/useApplicationAssessmentHistory";
import { useAssessmentNotifications } from "@/hooks/useAssessmentNotifications";
import { useSendAssessmentInvitation } from "@/hooks/useSendAssessmentInvitation";
import { useRetryAssessmentNotification } from "@/hooks/useRetryAssessmentNotification";
import { formatDateTime } from "@/lib/formatDate";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { ApplicationDetail } from "@/types/application";
import type { ApplicationAssessment, ApplicationAssessmentStatus } from "@/types/applicationAssessment";

export interface ApplicationAssessmentSectionProps {
  application: ApplicationDetail;
}

const RESULT_BADGE_CONFIG: Record<ApplicationAssessmentStatus, { label: string; variant: "neutral" | "success" | "destructive" }> = {
  pending: { label: "Pending", variant: "neutral" },
  passed: { label: "Passed", variant: "success" },
  failed: { label: "Failed", variant: "destructive" },
};

// Matches the Interviews section's own leading status-dot treatment —
// same three-state shape (in progress / resolved-positive / resolved-
// negative), same colors, so the two sections read as one workflow.
const STATUS_DOT_STYLES: Record<ApplicationAssessmentStatus, string> = {
  pending: "bg-primary text-primary-foreground",
  passed: "bg-success text-success-foreground",
  failed: "bg-destructive text-destructive-foreground",
};

// Renders nothing at all unless there's something to show: either the
// Application's CURRENT stage is an assessment-type stage (active
// controls, or "Add Assessment" if none exists yet for it), OR one or
// more historical assessment records exist from a stage the candidate has
// since moved past (read-only "Assessment History" — see this ticket's
// explicit "preserve assessment history visibly, just like Interview
// history" requirement). Never hosts the exam itself, never collects
// answers, and never builds a candidate-facing page (Part 15).
export function ApplicationAssessmentSection({ application }: ApplicationAssessmentSectionProps) {
  const isAssessmentStage = application.current_step?.type === "assessment";
  // One request covers both the active (current-stage) record and every
  // historical one — never a second request just to also learn the
  // current one, and never one request per historical stage.
  const { assessments, isLoading, error, refetch } = useApplicationAssessmentHistory(resourceUrlId(application));
  const assessment = assessments?.find((item) => item.is_current) ?? null;
  const historicalAssessments = assessments?.filter((item) => !item.is_current) ?? [];

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditingLink, setIsEditingLink] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const {
    notifications,
    isLoading: isLoadingNotifications,
    refetch: refetchNotifications,
  } = useAssessmentNotifications(assessment ? resourceUrlId(assessment) : null);
  const { run: runSend, isSubmitting: isSending, error: sendError, clearError: clearSendError } = useSendAssessmentInvitation();
  const { run: runRetry, isSubmitting: isRetrying, error: retryError, clearError: clearRetryError } = useRetryAssessmentNotification();

  const latestNotification = notifications && notifications.length > 0 ? notifications[0] : null;

  async function handleSend() {
    clearSendError();
    if (!assessment) return;
    const result = await runSend(resourceUrlId(assessment));
    if (result) refetchNotifications();
  }

  async function handleRetry(notificationId: string) {
    clearRetryError();
    if (!assessment) return;
    const result = await runRetry(resourceUrlId(assessment), notificationId);
    if (result) refetchNotifications();
  }

  function handleSaved(updated: ApplicationAssessment) {
    void updated;
    refetch();
  }

  // Loading: only the active card ever shows a skeleton (matching this
  // component's pre-history-feature behavior exactly) — a non-assessment
  // stage with no active card shows nothing until we actually know
  // whether history exists, avoiding a loading flash on every Application
  // Detail page regardless of relevance.
  if (isLoading) {
    return isAssessmentStage ? (
      <Card>
        <CardHeader>
          <CardTitle>External Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    ) : null;
  }

  // A failed fetch could be hiding either the active record or history (or
  // both) — always surface it rather than silently showing nothing.
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>External Assessment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <div className="flex-1">
              <p role="alert">{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={refetch}>
                Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!isAssessmentStage && historicalAssessments.length === 0) {
    return null;
  }

  return (
    <>
      {isAssessmentStage && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2.5">
              <span className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ClipboardCheck className="size-4" aria-hidden="true" />
              </span>
              External Assessment
            </CardTitle>
            {assessment &&
              (assessment.status === "pending" ? (
                <Button variant="outline" size="sm" onClick={() => setIsEditingLink(true)}>
                  Edit
                </Button>
              ) : (
                // A result has been recorded — the name/link are now
                // historical and read-only (see updateAssessmentLink's own
                // doc comment). A small muted note, not an error state.
                <span className="text-xs text-muted-foreground">Locked after result</span>
              ))}
          </CardHeader>
          <CardContent>
            {!assessment ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center">
                <ClipboardCheck className="size-6 text-muted-foreground" aria-hidden="true" />
                <p className="text-sm text-muted-foreground">No external assessment has been added yet.</p>
                <Button size="sm" onClick={() => setIsFormOpen(true)}>
                  Add Assessment
                </Button>
              </div>
            ) : (
              <div className="flex gap-3 rounded-lg border border-border p-3.5">
                <span
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${STATUS_DOT_STYLES[assessment.status]}`}
                  aria-hidden="true"
                >
                  {assessment.status === "passed" ? (
                    <Check className="size-3.5" />
                  ) : assessment.status === "failed" ? (
                    <X className="size-3" />
                  ) : null}
                </span>
                <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="font-medium text-foreground">{assessment.name}</p>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">External Link</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <a href={assessment.external_url} target="_blank" rel="noopener noreferrer">
                        Open Assessment
                      </a>
                    </Button>
                    <CopyAssessmentLinkButton url={assessment.external_url} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Candidate Email</p>
                  {isLoadingNotifications ? (
                    <Skeleton className="h-8 w-32" />
                  ) : !latestNotification ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">Not sent</span>
                      <Button variant="outline" size="sm" onClick={() => void handleSend()} disabled={isSending}>
                        {isSending ? "Sending…" : "Send Assessment"}
                      </Button>
                    </div>
                  ) : latestNotification.status === "sent" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-foreground">
                        Sent {formatDateTime(latestNotification.sent_at ?? latestNotification.created_at)}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => void handleSend()} disabled={isSending}>
                        {isSending ? "Sending…" : "Send Again"}
                      </Button>
                    </div>
                  ) : latestNotification.status === "failed" ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="destructive">Failed</Badge>
                      <Button variant="outline" size="sm" onClick={() => void handleRetry(resourceUrlId(latestNotification))} disabled={isRetrying}>
                        {isRetrying ? "Retrying…" : "Retry Email"}
                      </Button>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground">Sending…</span>
                  )}
                  {(sendError || retryError) && (
                    <p role="alert" className="text-xs text-destructive">
                      {sendError ?? retryError}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Result</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={RESULT_BADGE_CONFIG[assessment.status].variant}>{RESULT_BADGE_CONFIG[assessment.status].label}</Badge>
                    {assessment.grade != null && <span className="text-sm text-foreground">Grade {assessment.grade}%</span>}
                    <Button variant="outline" size="sm" onClick={() => setIsResultOpen(true)}>
                      Record Result
                    </Button>
                  </div>
                </div>

                {assessment.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm text-foreground">{assessment.notes}</p>
                  </div>
                )}
                </div>
              </div>
            )}
          </CardContent>

          <AssessmentFormDialog
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            applicationId={resourceUrlId(application)}
            existingAssessment={null}
            onSaved={handleSaved}
          />
          {assessment && (
            <>
              <AssessmentFormDialog
                open={isEditingLink}
                onOpenChange={setIsEditingLink}
                applicationId={resourceUrlId(application)}
                existingAssessment={assessment}
                onSaved={handleSaved}
              />
              <RecordAssessmentResultDialog open={isResultOpen} onOpenChange={setIsResultOpen} assessment={assessment} onSaved={handleSaved} />
            </>
          )}
        </Card>
      )}

      {/* Read-only — never offers Add Assessment or any active
          send/retry/result action for a stage the candidate has already
          moved past (see AssessmentHistorySection's own doc comment). */}
      <AssessmentHistorySection items={historicalAssessments} />
    </>
  );
}
