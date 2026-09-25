import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useCancelInterview } from "@/hooks/useCancelInterview";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { Interview } from "@/types/interview";

const REASON_MAX_LENGTH = 1000;

export interface CancelInterviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: Interview;
  onCancelled: (interview: Interview) => void;
}

// Local cancellation is always authoritative — see useCancelInterview's
// doc comment. Provider cleanup is best-effort; the caller surfaces
// calendar.sync_status separately, never as a reason this dialog itself
// failed.
export function CancelInterviewDialog({ open, onOpenChange, interview, onCancelled }: CancelInterviewDialogProps) {
  const { run, isSubmitting, error, clearError } = useCancelInterview();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);

  async function handleConfirm() {
    const trimmedReason = reason.trim();
    if (trimmedReason.length > REASON_MAX_LENGTH) {
      setReasonError(`Reason must be ${REASON_MAX_LENGTH} characters or fewer`);
      return;
    }
    setReasonError(null);

    const updated = await run(resourceUrlId(interview), { reason: trimmedReason || undefined });
    if (updated) {
      onOpenChange(false);
      onCancelled(updated);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          clearError();
          setReason("");
          setReasonError(null);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel interview</DialogTitle>
          <DialogDescription>
            This will cancel &ldquo;{interview.title}&rdquo;. This action cannot be undone — a cancelled interview cannot be
            rescheduled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="cancel-interview-reason">Cancellation reason (optional)</Label>
            <Textarea
              id="cancel-interview-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add context for this cancellation"
              disabled={isSubmitting}
              aria-invalid={!!reasonError}
              aria-describedby={reasonError ? "cancel-interview-reason-error" : undefined}
            />
            {reasonError && (
              <p id="cancel-interview-reason-error" role="alert" className="text-xs text-destructive">
                {reasonError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Keep interview
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleConfirm()} disabled={isSubmitting}>
              {isSubmitting ? "Cancelling…" : "Cancel interview"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
