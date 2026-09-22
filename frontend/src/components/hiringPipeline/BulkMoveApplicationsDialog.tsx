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
import { useBulkMoveApplications } from "@/hooks/useBulkMoveApplications";

export interface BulkMoveTargetStage {
  id: string;
  name: string;
  type: string;
}

export interface BulkMoveSelectedApplication {
  id: string;
  candidateName: string;
  /** null for a candidate currently in New Applicants (not a real HiringStep). */
  currentStepId: string | null;
}

export interface BulkMoveApplicationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  selectedApplications: BulkMoveSelectedApplication[];
  /** Every configured stage for this Job, in board order — never hard-coded stage names, since HR configures these. */
  availableStages: BulkMoveTargetStage[];
  /** Called once the move actually succeeds — the caller clears selection and shows its own success feedback. Never derived from the API response body (the frontend refetches instead, same convention as MoveApplicationDialog); movedCount/targetStepName are simply what was already known before the call. */
  onMoved: (movedCount: number, targetStepName: string) => void;
  /** Called after every attempt (success or failure), same rationale as MoveApplicationDialog's onRefetch. */
  onRefetch: () => void;
}

function consequenceCopyFor(stageType: string): string {
  if (stageType === "interview") {
    return "This updates their hiring stage. Interviews will still need to be scheduled individually.";
  }
  if (stageType === "assessment") {
    return "This updates their hiring stage. Assessments are managed separately.";
  }
  return "This updates their hiring stage.";
}

// A destination is fully excluded only when EVERY selected candidate is
// already there (the whole request would be a guaranteed no-op/conflict) —
// see Part 13. A destination where only SOME selected candidates are
// already there stays selectable, but submission is blocked with an
// explanation instead, since the backend treats even one such candidate as
// grounds to reject the entire batch (see hiringPipelineBoard.service.ts's
// bulkMoveApplications — "already in target" fails the whole batch, never
// a partial move).
export function BulkMoveApplicationsDialog({
  open,
  onOpenChange,
  jobId,
  selectedApplications,
  availableStages,
  onMoved,
  onRefetch,
}: BulkMoveApplicationsDialogProps) {
  const { run, isMoving, error, clearError } = useBulkMoveApplications();
  const [targetStepId, setTargetStepId] = useState("");

  const targetStages = availableStages.filter(
    (stage) => !selectedApplications.every((application) => application.currentStepId === stage.id)
  );

  const selectedStage = targetStages.find((stage) => stage.id === targetStepId) ?? null;
  const candidatesAlreadyAtTarget = selectedStage
    ? selectedApplications.filter((application) => application.currentStepId === selectedStage.id).length
    : 0;
  const blockedByMixedTarget = candidatesAlreadyAtTarget > 0;

  function resetAndClose() {
    setTargetStepId("");
    clearError();
    onOpenChange(false);
  }

  async function handleSubmit() {
    if (!targetStepId || !selectedStage || blockedByMixedTarget) return;

    const succeeded = await run(jobId, {
      application_ids: selectedApplications.map((application) => application.id),
      target_hiring_step_id: targetStepId,
    });
    onRefetch();
    if (succeeded) {
      onMoved(selectedApplications.length, selectedStage.name);
      setTargetStepId("");
      onOpenChange(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {selectedApplications.length} candidates</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <DialogDescription>
            {selectedApplications.length} candidate{selectedApplications.length === 1 ? "" : "s"} selected.
          </DialogDescription>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="bulk-move-target-stage">Destination</Label>
            <Select
              id="bulk-move-target-stage"
              value={targetStepId}
              onChange={(e) => setTargetStepId(e.target.value)}
              disabled={isMoving}
            >
              <option value="">Select a stage…</option>
              {targetStages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.name} (Type: {stage.type})
                </option>
              ))}
            </Select>
          </div>

          {selectedStage && !blockedByMixedTarget && (
            <p className="text-sm text-muted-foreground">
              Move {selectedApplications.length} candidates to "{selectedStage.name}"? {consequenceCopyFor(selectedStage.type)}
            </p>
          )}

          {selectedStage && blockedByMixedTarget && (
            <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning" role="alert">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p>
                {candidatesAlreadyAtTarget} of the selected candidates {candidatesAlreadyAtTarget === 1 ? "is" : "are"} already in
                "{selectedStage.name}". Deselect them or choose a different destination.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isMoving}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isMoving || !targetStepId || blockedByMixedTarget}
            >
              {isMoving ? "Moving…" : "Move Candidates"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
