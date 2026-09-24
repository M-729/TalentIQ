import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useRecordAssessmentResult } from "@/hooks/useRecordAssessmentResult";
import type { ApplicationAssessment, ApplicationAssessmentStatus } from "@/types/applicationAssessment";

export interface RecordAssessmentResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assessment: ApplicationAssessment;
  onSaved: (assessment: ApplicationAssessment) => void;
}

const STATUS_LABELS: Record<ApplicationAssessmentStatus, string> = {
  pending: "Pending",
  passed: "Passed",
  failed: "Failed",
};

// Grade is always optional and never derived from status — HR explicitly
// chooses Pending/Passed/Failed (see this ticket's explicit Part 2/6/18).
// Never triggers a pipeline movement or a candidate email — result editing
// is a normal controlled update for this scope (Part 19).
export function RecordAssessmentResultDialog({ open, onOpenChange, assessment, onSaved }: RecordAssessmentResultDialogProps) {
  const { run, isSubmitting, error, clearError } = useRecordAssessmentResult();

  const [status, setStatus] = useState<ApplicationAssessmentStatus>(assessment.status);
  const [grade, setGrade] = useState(assessment.grade != null ? String(assessment.grade) : "");
  const [notes, setNotes] = useState(assessment.notes ?? "");
  const [gradeError, setGradeError] = useState<string | null>(null);

  function resetAndClose() {
    setStatus(assessment.status);
    setGrade(assessment.grade != null ? String(assessment.grade) : "");
    setNotes(assessment.notes ?? "");
    setGradeError(null);
    clearError();
    onOpenChange(false);
  }

  async function handleSubmit() {
    let parsedGrade: number | null = null;
    if (grade.trim() !== "") {
      const value = Number(grade);
      if (Number.isNaN(value) || value < 0 || value > 100) {
        setGradeError("Grade must be a number between 0 and 100.");
        return;
      }
      parsedGrade = value;
    }
    setGradeError(null);

    const saved = await run(assessment.id, { status, grade: parsedGrade, notes: notes.trim() || null });
    if (saved) {
      onSaved(saved);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? resetAndClose() : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record result</DialogTitle>
          <DialogDescription className="sr-only">Record the outcome of this candidate's assessment.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="assessment-result-status">
              Result<span className="text-destructive"> *</span>
            </Label>
            <Select
              id="assessment-result-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as ApplicationAssessmentStatus)}
              disabled={isSubmitting}
            >
              {(Object.keys(STATUS_LABELS) as ApplicationAssessmentStatus[]).map((value) => (
                <option key={value} value={value}>
                  {STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assessment-result-grade">Grade (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="assessment-result-grade"
                type="number"
                min={0}
                max={100}
                step="any"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                placeholder="84"
                disabled={isSubmitting}
                className="max-w-[120px]"
                aria-invalid={!!gradeError}
                aria-describedby={gradeError ? "assessment-result-grade-error" : undefined}
              />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            {gradeError && (
              <p id="assessment-result-grade-error" role="alert" className="text-xs text-destructive">
                {gradeError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assessment-result-notes">Notes (optional)</Label>
            <Textarea
              id="assessment-result-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Strong API knowledge, weaker SQL section."
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Saving…" : "Save Result"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
