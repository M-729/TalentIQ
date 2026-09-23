import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useRejectApplication } from "@/hooks/useRejectApplication";

export interface RejectCandidateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  onRejected: () => void;
}

// Rejecting is always an explicit HR decision — never automatic (see this
// ticket's core principle). The candidate email is entirely optional and
// professional; no AI score, assessment grade, interviewer feedback, or
// internal rejection reason is ever exposed here or sent to the candidate
// (see rejection.service.ts's own doc comment).
export function RejectCandidateDialog({ open, onOpenChange, applicationId, onRejected }: RejectCandidateDialogProps) {
  const { run, isSubmitting, error, clearError } = useRejectApplication();
  const [sendEmail, setSendEmail] = useState(false);

  async function handleConfirm() {
    const result = await run(applicationId, { send_email: sendEmail });
    if (result) {
      onOpenChange(false);
      onRejected();
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          clearError();
          setSendEmail(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reject candidate?</DialogTitle>
          <DialogDescription>This will mark the application as rejected. You may optionally notify the candidate by email.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Checkbox
              id="reject-send-email"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
              disabled={isSubmitting}
            />
            <Label htmlFor="reject-send-email" className="font-normal">
              Send rejection email
            </Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleConfirm()} disabled={isSubmitting}>
              {isSubmitting ? "Rejecting…" : "Reject Candidate"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
