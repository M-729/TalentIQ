import { useState } from "react";
import { AlertCircle, Award, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { OfferActionConfirmDialog } from "@/components/applications/OfferActionConfirmDialog";
import { OfferFormDialog } from "@/components/applications/OfferFormDialog";
import { RecordOfferResponseDialog } from "@/components/applications/RecordOfferResponseDialog";
import { RejectCandidateDialog } from "@/components/applications/RejectCandidateDialog";
import { useApplicationOffer } from "@/hooks/useApplicationOffer";
import { useMarkApplicationHired } from "@/hooks/useMarkApplicationHired";
import { useOfferNotifications } from "@/hooks/useOfferNotifications";
import { useRejectionInfo } from "@/hooks/useRejectionInfo";
import { useRetryOfferNotification } from "@/hooks/useRetryOfferNotification";
import { useRetryRejectionEmail } from "@/hooks/useRetryRejectionEmail";
import { useSendOffer } from "@/hooks/useSendOffer";
import { useWithdrawOffer } from "@/hooks/useWithdrawOffer";
import { formatDateTime } from "@/lib/formatDate";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { ApplicationDetail } from "@/types/application";
import type { Offer, OfferStatus } from "@/types/offer";

export interface OfferDecisionSectionProps {
  application: ApplicationDetail;
  /** Called after Reject/Mark as Hired change application.status — re-fetches the Application so the rest of the page (header status badge, etc.) reflects it too. */
  onApplicationChanged: () => void;
}

const OFFER_STATUS_CONFIG: Record<OfferStatus, { label: string; variant: "neutral" | "success" | "destructive" | "warning" }> = {
  draft: { label: "Draft", variant: "neutral" },
  sent: { label: "Sent", variant: "warning" },
  accepted: { label: "Accepted", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
  withdrawn: { label: "Withdrawn", variant: "neutral" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatSalary(offer: Offer): string | null {
  if (offer.salary_amount == null || !offer.salary_currency) return null;
  return `${offer.salary_amount.toLocaleString()} ${offer.salary_currency}`;
}

// The Application Detail page's "Final Decision / Offer" section — every
// hiring outcome (Create Offer, Reject Candidate, Send Offer, Mark
// Accepted/Declined, Withdraw, Mark as Hired) is an explicit HR action
// here; nothing in this component ever fires automatically from AI score,
// interview feedback, or assessment result (see this ticket's core
// principle). Always renders, regardless of the Application's current
// pipeline stage — unlike ApplicationAssessmentSection, a final decision
// isn't scoped to any one HiringStep.
export function OfferDecisionSection({ application, onApplicationChanged }: OfferDecisionSectionProps) {
  const { offer, isLoading, error, refetch } = useApplicationOffer(resourceUrlId(application));
  const isRejected = application.status === "rejected";
  const { rejection } = useRejectionInfo(isRejected ? resourceUrlId(application) : null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [isRecordResponseOpen, setIsRecordResponseOpen] = useState(false);
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [isHireOpen, setIsHireOpen] = useState(false);

  // Gated on the Offer's own id (never on offer.status) — a Send Offer
  // click needs THIS render's refetchNotifications to already be bound to
  // a real, working offer id, not null. Gating on status === "sent" meant
  // that, at the moment handleSend() ran (still mid-"draft" render),
  // refetchNotifications was a no-op bound to offerId: null — the
  // notification list only ever caught up later, indirectly, once the
  // offer's own refetch() resolved and re-rendered with status "sent".
  // Fetching by id keeps the SAME stable id across the draft->sent
  // transition, so refetchNotifications() called from handleSend() does a
  // real, immediate fetch — see this ticket's "no stale Not sent after a
  // successful Send" bug report.
  const {
    notifications,
    isLoading: isLoadingNotifications,
    refetch: refetchNotifications,
  } = useOfferNotifications(offer ? resourceUrlId(offer) : null);
  const { run: runSend, isSubmitting: isSending, error: sendError, clearError: clearSendError } = useSendOffer();
  const { run: runRetry, isSubmitting: isRetrying, error: retryError, clearError: clearRetryError } = useRetryOfferNotification();
  const { run: runWithdraw, isSubmitting: isWithdrawing, error: withdrawError, clearError: clearWithdrawError } = useWithdrawOffer();
  const { run: runHire, isSubmitting: isHiring, error: hireError, clearError: clearHireError } = useMarkApplicationHired();
  const { run: runRetryRejection, isSubmitting: isRetryingRejection, error: retryRejectionError, clearError: clearRetryRejectionError } = useRetryRejectionEmail();

  const latestNotification = notifications && notifications.length > 0 ? notifications[0] : null;

  function handleOfferSaved(_updated: Offer) {
    void _updated;
    refetch();
  }

  async function handleSend() {
    clearSendError();
    if (!offer) return;
    const result = await runSend(resourceUrlId(offer));
    if (result) {
      refetch();
      refetchNotifications();
    }
  }

  async function handleRetry(notificationId: string) {
    clearRetryError();
    if (!offer) return;
    const result = await runRetry(resourceUrlId(offer), notificationId);
    if (result) refetchNotifications();
  }

  function handleResponseRecorded(_updated: Offer) {
    void _updated;
    refetch();
  }

  async function handleWithdraw() {
    clearWithdrawError();
    if (!offer) return;
    const result = await runWithdraw(resourceUrlId(offer));
    if (result) {
      setIsWithdrawOpen(false);
      refetch();
    }
  }

  async function handleHire() {
    clearHireError();
    if (!offer) return;
    const result = await runHire(resourceUrlId(offer));
    if (result) {
      setIsHireOpen(false);
      onApplicationChanged();
      refetch();
    }
  }

  async function handleRetryRejection() {
    clearRetryRejectionError();
    await runRetryRejection(resourceUrlId(application));
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Final Decision</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Final Decision</CardTitle>
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

  // ===== Hired =====
  if (application.status === "hired") {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Final Decision</CardTitle>
          <Badge variant="success">
            <Award className="mr-1 size-3.5" aria-hidden="true" />
            Hired
          </Badge>
        </CardHeader>
        {offer && (
          <CardContent className="space-y-1.5 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{offer.title}</p>
            {formatSalary(offer) && <p>{formatSalary(offer)}</p>}
            {offer.start_date && <p>Start date: {formatDate(offer.start_date)}</p>}
          </CardContent>
        )}
      </Card>
    );
  }

  // ===== Rejected =====
  if (isRejected) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <CardTitle>Final Decision</CardTitle>
          <Badge variant="destructive">
            <XCircle className="mr-1 size-3.5" aria-hidden="true" />
            Rejected
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {rejection?.email_status && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Candidate email: {rejection.email_status === "sent" ? "Sent" : rejection.email_status === "failed" ? "Failed" : "Sending…"}
              </span>
              {rejection.email_status === "failed" && (
                <Button variant="outline" size="sm" onClick={() => void handleRetryRejection()} disabled={isRetryingRejection}>
                  {isRetryingRejection ? "Retrying…" : "Retry Email"}
                </Button>
              )}
            </div>
          )}
          {retryRejectionError && (
            <p role="alert" className="text-xs text-destructive">
              {retryRejectionError}
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // ===== No live offer yet =====
  if (!offer) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Final Decision</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setIsFormOpen(true)}>
            Create Offer
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsRejectOpen(true)}>
            Reject Candidate
          </Button>
        </CardContent>

        <OfferFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} applicationId={resourceUrlId(application)} existingOffer={null} onSaved={handleOfferSaved} />
        <RejectCandidateDialog
          open={isRejectOpen}
          onOpenChange={setIsRejectOpen}
          applicationId={resourceUrlId(application)}
          onRejected={onApplicationChanged}
        />
      </Card>
    );
  }

  const statusConfig = OFFER_STATUS_CONFIG[offer.status];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Offer</CardTitle>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="font-medium text-foreground">{offer.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {formatSalary(offer) && <span>{formatSalary(offer)}</span>}
            {offer.start_date && <span>Start: {formatDate(offer.start_date)}</span>}
            {offer.expires_at && <span>Expires: {formatDate(offer.expires_at)}</span>}
          </div>
        </div>

        {offer.status === "draft" && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
              Edit
            </Button>
            <Button size="sm" onClick={() => void handleSend()} disabled={isSending}>
              {isSending ? "Sending…" : "Send Offer"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setIsWithdrawOpen(true)}>
              Withdraw
            </Button>
          </div>
        )}
        {sendError && (
          <p role="alert" className="text-xs text-destructive">
            {sendError}
          </p>
        )}

        {offer.status === "sent" && (
          <>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">Candidate Email</p>
              {isLoadingNotifications ? (
                <span className="text-sm text-muted-foreground">Loading…</span>
              ) : !latestNotification ? (
                // Once an Offer is "sent", a send attempt has always been
                // made — a real EmailNotification row is created in the
                // SAME transaction as the sent transition (see
                // offerEmail.service.ts's sendOffer), so an empty result
                // here can only mean legacy/inconsistent data, never "HR
                // forgot to send it". Never show "Not sent" for a sent
                // Offer — that would misleadingly suggest no attempt was
                // ever made.
                <span className="text-sm text-muted-foreground">Email status unavailable</span>
              ) : latestNotification.status === "sent" ? (
                <span className="text-sm text-foreground">
                  Sent {formatDateTime(latestNotification.sent_at ?? latestNotification.created_at)}
                </span>
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
              {retryError && (
                <p role="alert" className="text-xs text-destructive">
                  {retryError}
                </p>
              )}
            </div>

            {/* The candidate's own email confirmation is now the primary
                path — Mark Accepted/Mark Declined are no longer offered as
                direct buttons here. See RecordOfferResponseDialog for the
                explicit manual fallback, kept clearly secondary below. */}
            <p className="text-sm text-muted-foreground">Waiting for candidate response</p>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsWithdrawOpen(true)}>
                Withdraw Offer
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setIsRecordResponseOpen(true)}>
                Record response manually
              </Button>
            </div>
          </>
        )}

        {(offer.status === "accepted" || offer.status === "declined") && offer.responded_at && (
          <p className="text-xs text-muted-foreground">
            {offer.response_source === "candidate"
              ? `${statusConfig.label} by candidate · ${formatDate(offer.responded_at)}`
              : `${statusConfig.label} · Recorded by HR · ${formatDate(offer.responded_at)}`}
          </p>
        )}

        {offer.status === "accepted" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setIsHireOpen(true)}>
              Mark as Hired
            </Button>
          </div>
        )}
      </CardContent>

      <OfferFormDialog open={isEditOpen} onOpenChange={setIsEditOpen} applicationId={resourceUrlId(application)} existingOffer={offer} onSaved={handleOfferSaved} />

      <RecordOfferResponseDialog
        open={isRecordResponseOpen}
        onOpenChange={setIsRecordResponseOpen}
        offerId={resourceUrlId(offer)}
        onRecorded={handleResponseRecorded}
      />
      <OfferActionConfirmDialog
        open={isWithdrawOpen}
        onOpenChange={setIsWithdrawOpen}
        title="Withdraw this offer?"
        description="The offer will no longer be active. You can create a new offer for this candidate afterward if needed."
        confirmLabel="Withdraw Offer"
        submittingLabel="Withdrawing…"
        destructive
        isSubmitting={isWithdrawing}
        error={withdrawError}
        onConfirm={() => void handleWithdraw()}
      />
      <OfferActionConfirmDialog
        open={isHireOpen}
        onOpenChange={setIsHireOpen}
        title="Mark as Hired?"
        description="This completes the hiring workflow for this candidate. This cannot be undone from here."
        confirmLabel="Mark as Hired"
        submittingLabel="Marking…"
        isSubmitting={isHiring}
        error={hireError}
        onConfirm={() => void handleHire()}
      />
    </Card>
  );
}
