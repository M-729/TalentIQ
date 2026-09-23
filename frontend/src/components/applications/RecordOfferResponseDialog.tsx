import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useMarkOfferAccepted } from "@/hooks/useMarkOfferAccepted";
import { useMarkOfferDeclined } from "@/hooks/useMarkOfferDeclined";
import type { Offer } from "@/types/offer";

export interface RecordOfferResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offerId: string;
  onRecorded: (offer: Offer) => void;
}

type ManualDecision = "accepted" | "declined";

// The explicit HR fallback for a response received OUTSIDE the TalentIQ
// email link (phone, ordinary email, ...) — see this ticket's explicit
// "HR must still have a MANUAL fallback" rule. Deliberately secondary in
// the parent section's UI (a "Record response manually" action, not the
// primary Accepted/Declined buttons it replaces) — the candidate's own
// email link confirmation is now the primary path. Calls the exact same
// authenticated markOfferAccepted/markOfferDeclined endpoints as before,
// which now record response_source: "hr" server-side.
export function RecordOfferResponseDialog({ open, onOpenChange, offerId, onRecorded }: RecordOfferResponseDialogProps) {
  const { run: runAccept, isSubmitting: isAccepting, error: acceptError, clearError: clearAcceptError } = useMarkOfferAccepted();
  const { run: runDecline, isSubmitting: isDeclining, error: declineError, clearError: clearDeclineError } = useMarkOfferDeclined();
  const [decision, setDecision] = useState<ManualDecision>("accepted");

  const isSubmitting = isAccepting || isDeclining;
  const error = acceptError ?? declineError;

  function resetAndClose() {
    setDecision("accepted");
    clearAcceptError();
    clearDeclineError();
    onOpenChange(false);
  }

  async function handleSubmit() {
    const result = decision === "accepted" ? await runAccept(offerId) : await runDecline(offerId);
    if (result) {
      onOpenChange(false);
      onRecorded(result);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? resetAndClose() : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record candidate response</DialogTitle>
          <DialogDescription>Use this when the candidate responded outside the TalentIQ email link (phone, a separate email, etc.).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="sr-only">Response</legend>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="manual-response-accepted"
                name="manual-response"
                value="accepted"
                checked={decision === "accepted"}
                onChange={() => setDecision("accepted")}
                disabled={isSubmitting}
                className="size-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Label htmlFor="manual-response-accepted" className="font-normal">
                Accepted
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="manual-response-declined"
                name="manual-response"
                value="declined"
                checked={decision === "declined"}
                onChange={() => setDecision("declined")}
                disabled={isSubmitting}
                className="size-4 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
              <Label htmlFor="manual-response-declined" className="font-normal">
                Declined
              </Label>
            </div>
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Recording…" : "Record response"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
