import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCompleteInterview } from "@/hooks/useCompleteInterview";
import type { Interview } from "@/types/interview";

export interface MarkCompletedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interview: Interview;
  onCompleted: (interview: Interview) => void;
}

// Completion is a normal, positive workflow step — never styled as a
// destructive/dangerous action (see this ticket's explicit "do not use
// scary destructive styling" rule). Uses the default (primary) Button
// variant throughout, unlike CancelInterviewDialog's destructive one.
export function MarkCompletedDialog({ open, onOpenChange, interview, onCompleted }: MarkCompletedDialogProps) {
  const { run, isSubmitting, error, clearError } = useCompleteInterview();

  async function handleConfirm() {
    const updated = await run(interview.id);
    if (updated) {
      onOpenChange(false);
      onCompleted(updated);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) clearError();
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark interview as completed?</DialogTitle>
          <DialogDescription>
            This confirms the interview has taken place and enables interviewer feedback for &ldquo;{interview.title}&rdquo;.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleConfirm()} disabled={isSubmitting}>
              {isSubmitting ? "Marking as completed…" : "Mark as Completed"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
