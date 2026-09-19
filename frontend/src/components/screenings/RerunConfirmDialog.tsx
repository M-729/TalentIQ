import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RerunConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isCreating: boolean;
}

export function RerunConfirmDialog({ open, onOpenChange, onConfirm, isCreating }: RerunConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Re-run AI screening?</DialogTitle>
          <DialogDescription>
            This will analyze the application again and create a new screening record. Previous screenings will
            remain in history.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isCreating}>
            {isCreating ? "Re-running…" : "Re-run Screening"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
