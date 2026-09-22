import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateApplicationAssessment } from "@/hooks/useCreateApplicationAssessment";
import { useUpdateApplicationAssessmentLink } from "@/hooks/useUpdateApplicationAssessmentLink";
import type { ApplicationAssessment } from "@/types/applicationAssessment";

export interface AssessmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  applicationId: string;
  /** Present -> editing that assessment's name/link. Absent -> creating a new one. */
  existingAssessment: ApplicationAssessment | null;
  onSaved: (assessment: ApplicationAssessment) => void;
}

function isValidHttpUrl(value: string): boolean {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

// One form, two modes — creating (POST .../assessment) vs. correcting an
// already-saved link (PATCH .../application-assessments/:id). Editing
// NEVER re-sends the candidate email on its own (see this ticket's
// explicit Part 7) — Send Again is always a separate, explicit action.
export function AssessmentFormDialog({ open, onOpenChange, applicationId, existingAssessment, onSaved }: AssessmentFormDialogProps) {
  const isEditing = !!existingAssessment;
  const { run: runCreate, isSubmitting: isCreating, error: createError, clearError: clearCreateError } = useCreateApplicationAssessment();
  const { run: runUpdate, isSubmitting: isUpdating, error: updateError, clearError: clearUpdateError } = useUpdateApplicationAssessmentLink();

  const [name, setName] = useState(existingAssessment?.name ?? "");
  const [externalUrl, setExternalUrl] = useState(existingAssessment?.external_url ?? "");
  const [urlError, setUrlError] = useState<string | null>(null);

  const isSubmitting = isCreating || isUpdating;
  const serverError = createError ?? updateError;

  function resetAndClose() {
    setName(existingAssessment?.name ?? "");
    setExternalUrl(existingAssessment?.external_url ?? "");
    setUrlError(null);
    clearCreateError();
    clearUpdateError();
    onOpenChange(false);
  }

  async function handleSubmit() {
    const trimmedName = name.trim();
    const trimmedUrl = externalUrl.trim();

    if (!isValidHttpUrl(trimmedUrl)) {
      setUrlError("Enter a valid http or https link.");
      return;
    }
    setUrlError(null);

    const saved = isEditing
      ? await runUpdate(existingAssessment!.id, { name: trimmedName, external_url: trimmedUrl })
      : await runCreate(applicationId, { name: trimmedName, external_url: trimmedUrl });

    if (saved) {
      onSaved(saved);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? resetAndClose() : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit assessment link" : "Add assessment"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {serverError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <p role="alert">{serverError}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="assessment-name">Assessment name</Label>
            <Input
              id="assessment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Backend Technical Test"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="assessment-external-url">External exam URL</Label>
            <Input
              id="assessment-external-url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://external-platform.example/test/abc"
              disabled={isSubmitting}
              aria-invalid={!!urlError}
              aria-describedby={urlError ? "assessment-external-url-error" : undefined}
            />
            {urlError && (
              <p id="assessment-external-url-error" role="alert" className="text-xs text-destructive">
                {urlError}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={resetAndClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleSubmit()} disabled={isSubmitting || !name.trim() || !externalUrl.trim()}>
              {isSubmitting ? "Saving…" : "Save Assessment"}
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
