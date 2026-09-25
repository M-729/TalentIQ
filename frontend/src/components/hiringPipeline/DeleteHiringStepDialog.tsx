import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDeleteHiringStep } from "@/hooks/useDeleteHiringStep";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { HiringStep } from "@/types/hiringStep";

export interface DeleteHiringStepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  step: HiringStep | null;
  onSuccess: () => void;
}

// If the backend returns 409 (stage still in use by one or more
// Applications), this dialog surfaces that as a safe explanatory message
// and leaves the stage completely untouched — it never auto-moves
// applicants, clears their current stage, or force-deletes.
export function DeleteHiringStepDialog({ open, onOpenChange, jobId, step, onSuccess }: DeleteHiringStepDialogProps) {
  const { run, isDeleting, error, clearError } = useDeleteHiringStep(jobId);

  async function handleConfirm() {
    if (!step) return;
    const succeeded = await run(resourceUrlId(step));
    if (succeeded) {
      onSuccess();
      onOpenChange(false);
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
          <DialogTitle>Delete hiring stage?</DialogTitle>
          <DialogDescription>
            Deleting {step ? `"${step.name}"` : "this stage"} removes it from this job's pipeline. Historical stage
            transition records remain unchanged.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p role="alert">{error}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={() => void handleConfirm()} disabled={isDeleting}>
            {isDeleting ? "Deleting…" : "Delete stage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
