import { useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMoveApplicationHiringStep } from "@/hooks/useMoveApplicationHiringStep";
import type { HiringPipelineApplicationCard, MoveApplicationHiringStepInput } from "@/types/hiringPipelineBoard";

const NOTE_MAX_LENGTH = 1000;

export interface MoveTargetStage {
  id: string;
  name: string;
}

export interface MoveApplicationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  application: HiringPipelineApplicationCard | null;
  /** "New Applicants" or the current stage's name, for display only. */
  currentLabel: string;
  /** null when the applicant is currently in New Applicants (not a real HiringStep). */
  currentStepId: string | null;
  /** Every configured stage for this Job, in board order — the current stage is filtered out below. */
  availableStages: MoveTargetStage[];
  /** Called after every attempt (success or failure) so the board re-syncs with the server — see task report on why failures also refetch. */
  onRefetch: () => void;
}

interface MoveApplicationFormProps {
  candidateName: string;
  currentLabel: string;
  targetStages: MoveTargetStage[];
  isMoving: boolean;
  serverError: string | null;
  onCancel: () => void;
  onSubmit: (input: MoveApplicationHiringStepInput) => void;
}

// A separate inner component (mounted only while `application` is set) so
// its local form state resets cleanly on every open, the same pattern
// HiringStepFormDialog.tsx already uses for HiringStepForm.
function MoveApplicationForm({
  candidateName,
  currentLabel,
  targetStages,
  isMoving,
  serverError,
  onCancel,
  onSubmit,
}: MoveApplicationFormProps) {
  const [targetStepId, setTargetStepId] = useState("");
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmedNote = note.trim();
    if (trimmedNote.length > NOTE_MAX_LENGTH) {
      setNoteError(`Note must be ${NOTE_MAX_LENGTH} characters or fewer`);
      return;
    }
    setNoteError(null);
    // step_id + optional note only — job_id/company_id/status/moved_by/
    // current-step are all backend-derived and never sent from here (see
    // MoveApplicationHiringStepInput).
    onSubmit({ step_id: targetStepId, note: trimmedNote || undefined });
  }

  return (
    <div className="space-y-4">
      <DialogDescription>{candidateName}</DialogDescription>

      {serverError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{serverError}</p>
        </div>
      )}

      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">Current</p>
        <p className="text-sm text-muted-foreground">{currentLabel}</p>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="move-target-stage">Move to</Label>
        <Select
          id="move-target-stage"
          value={targetStepId}
          onChange={(e) => setTargetStepId(e.target.value)}
          disabled={isMoving}
        >
          <option value="">Select a stage…</option>
          {targetStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="move-note">Transition note (optional)</Label>
        <Textarea
          id="move-note"
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add context for this stage movement"
          disabled={isMoving}
          aria-invalid={!!noteError}
          aria-describedby={noteError ? "move-note-error" : undefined}
        />
        {noteError && (
          <p id="move-note-error" role="alert" className="text-xs text-destructive">
            {noteError}
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isMoving}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isMoving || !targetStepId}>
          {isMoving ? "Moving…" : "Move Applicant"}
        </Button>
      </DialogFooter>
    </div>
  );
}

// Backward movement is fully supported (the target list is simply "every
// other configured stage"); "New Applicants" is never offered as a
// target — the backend intentionally has no HiringStep -> null move, so
// offering it would only produce a guaranteed failure.
export function MoveApplicationDialog({
  open,
  onOpenChange,
  application,
  currentLabel,
  currentStepId,
  availableStages,
  onRefetch,
}: MoveApplicationDialogProps) {
  const { run, isMoving, error, clearError } = useMoveApplicationHiringStep();

  const targetStages = availableStages.filter((stage) => stage.id !== currentStepId);

  async function handleSubmit(input: MoveApplicationHiringStepInput) {
    if (!application) return;
    const succeeded = await run(application.id, input);
    // Refetch on every attempt, not just success — a 409 in particular
    // means another recruiter changed this application concurrently, so
    // the board the user is looking at may already be stale (see
    // getMoveErrorMessage's "refresh the pipeline" copy). Re-syncing here
    // is always safe: it's a read-only GET regardless of outcome.
    onRefetch();
    if (succeeded) {
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
          <DialogTitle>Move applicant</DialogTitle>
        </DialogHeader>
        {application && (
          <MoveApplicationForm
            candidateName={application.candidate.full_name}
            currentLabel={currentLabel}
            targetStages={targetStages}
            isMoving={isMoving}
            serverError={error}
            onCancel={() => onOpenChange(false)}
            onSubmit={(input) => void handleSubmit(input)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
