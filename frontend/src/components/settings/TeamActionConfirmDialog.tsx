import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export interface TeamActionConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  submittingLabel: string;
  destructive?: boolean;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => void;
}

// One shared confirmation shell for every no-input Team action (Revoke
// Invitation / Deactivate / Reactivate) — mirrors
// components/applications/OfferActionConfirmDialog.tsx's exact shape,
// kept as its own small component in this feature's own directory rather
// than importing across features (established codebase convention: one
// hand-rolled, purpose-built dialog per feature).
export function TeamActionConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  submittingLabel,
  destructive = false,
  isSubmitting,
  error,
  onConfirm,
}: TeamActionConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
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
            <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
