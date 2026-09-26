import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HiringStepForm } from "@/components/hiringPipeline/HiringStepForm";
import { useCreateHiringStep } from "@/hooks/useCreateHiringStep";
import { useUpdateHiringStep } from "@/hooks/useUpdateHiringStep";
import { resourceUrlId } from "@/lib/resourceUrlId";
import type { CreateHiringStepInput, HiringStep } from "@/types/hiringStep";

export interface HiringStepFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  mode: "create" | "edit";
  step?: HiringStep;
  onSuccess: () => void;
}

// One reusable dialog for both Add Stage and Edit Stage — Radix's Dialog
// content unmounts on close, so each open starts the form fresh from
// `step` (or blank, for create) without any manual reset logic.
export function HiringStepFormDialog({ open, onOpenChange, jobId, mode, step, onSuccess }: HiringStepFormDialogProps) {
  const create = useCreateHiringStep(jobId);
  const update = useUpdateHiringStep(jobId);

  const isSubmitting = mode === "create" ? create.isCreating : update.isUpdating;
  const serverError = mode === "create" ? create.error : update.error;

  async function handleSubmit(payload: CreateHiringStepInput) {
    const result =
      mode === "create" ? await create.run(payload) : step ? await update.run(resourceUrlId(step), payload) : null;

    if (result) {
      onSuccess();
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          create.clearError();
          update.clearError();
        }
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">{mode === "create" ? "Add hiring stage" : "Edit hiring stage"}</DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a stage that matches this job's real recruitment process. You choose the name — the type tells TalentIQ what kind of step it is."
              : "Update this stage's name, type, or description. Ordering is changed separately with Move Up/Down."}
          </DialogDescription>
        </DialogHeader>
        <HiringStepForm
          mode={mode}
          step={step}
          isSubmitting={isSubmitting}
          serverError={serverError}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
