import { useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RECOMMENDATION_LABELS, RecommendationBadge } from "@/components/interviews/RecommendationBadge";
import { useSaveFeedbackDraft } from "@/hooks/useSaveFeedbackDraft";
import { useSubmitFeedback } from "@/hooks/useSubmitFeedback";
import { formatDateTime } from "@/lib/formatDate";
import { INTERVIEW_FEEDBACK_RECOMMENDATIONS, type InterviewFeedback, type InterviewFeedbackRecommendation } from "@/types/interviewFeedback";

const MAX_TEXT_LENGTH = 4000;

export interface InterviewFeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  interviewId: string;
  /** The current viewer's OWN feedback record (draft or submitted) — never another interviewer's. Null when they haven't started yet. */
  ownFeedback: InterviewFeedback | null;
  onSaved: (feedback: InterviewFeedback) => void;
}

interface FormErrors {
  recommendation?: string;
  summary?: string;
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">{value}</dd>
    </div>
  );
}

// A submitted record is read-only here — see backend
// interviewFeedback.service.ts's submitFeedback doc comment: this ticket
// treats submitted feedback as immutable, so this component never offers
// an edit path for it, only a read view.
function SubmittedFeedbackView({ feedback }: { feedback: InterviewFeedback }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {feedback.recommendation && <RecommendationBadge recommendation={feedback.recommendation} />}
        {feedback.submitted_at && (
          <span className="text-xs text-muted-foreground">Submitted {formatDateTime(feedback.submitted_at)}</span>
        )}
      </div>
      <dl className="space-y-3">
        <Field label="Summary" value={feedback.summary} />
        <Field label="Strengths" value={feedback.strengths} />
        <Field label="Concerns" value={feedback.concerns} />
        <Field label="Private Notes" value={feedback.private_notes} />
      </dl>
    </div>
  );
}

// Draft/new feedback — editable, with an explicit Save Draft vs. Submit
// distinction and a confirmation step before submission (this ticket's
// explicit "submitting should require confirmation" rule), rendered inline
// rather than as a nested dialog.
function EditableFeedbackForm({
  interviewId,
  ownFeedback,
  onSaved,
  onClose,
}: {
  interviewId: string;
  ownFeedback: InterviewFeedback | null;
  onSaved: (feedback: InterviewFeedback) => void;
  onClose: () => void;
}) {
  const { run: saveDraft, isSubmitting: isSavingDraft, error: draftError, clearError: clearDraftError } = useSaveFeedbackDraft();
  const { run: submit, isSubmitting: isSubmittingFeedback, error: submitError, clearError: clearSubmitError } = useSubmitFeedback();

  const [recommendation, setRecommendation] = useState<InterviewFeedbackRecommendation | "">(ownFeedback?.recommendation ?? "");
  const [summary, setSummary] = useState(ownFeedback?.summary ?? "");
  const [strengths, setStrengths] = useState(ownFeedback?.strengths ?? "");
  const [concerns, setConcerns] = useState(ownFeedback?.concerns ?? "");
  const [privateNotes, setPrivateNotes] = useState(ownFeedback?.private_notes ?? "");
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmingSubmit, setConfirmingSubmit] = useState(false);

  const isBusy = isSavingDraft || isSubmittingFeedback;

  async function handleSaveDraft() {
    clearDraftError();
    const saved = await saveDraft(interviewId, {
      recommendation: recommendation || null,
      summary,
      strengths,
      concerns,
      private_notes: privateNotes,
    });
    if (saved) onSaved(saved);
  }

  function validateForSubmit(): FormErrors {
    const nextErrors: FormErrors = {};
    if (!recommendation) nextErrors.recommendation = "An overall recommendation is required";
    if (!summary.trim()) nextErrors.summary = "A summary is required";
    return nextErrors;
  }

  function handleSubmitClick() {
    const validationErrors = validateForSubmit();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setConfirmingSubmit(true);
  }

  async function handleConfirmSubmit() {
    clearSubmitError();
    const submitted = await submit(interviewId, {
      recommendation: recommendation as InterviewFeedbackRecommendation,
      summary: summary.trim(),
      strengths,
      concerns,
      private_notes: privateNotes,
    });
    if (submitted) {
      onSaved(submitted);
    } else {
      setConfirmingSubmit(false);
    }
  }

  if (confirmingSubmit) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-foreground">
          Submit feedback? Submitted feedback becomes read-only and cannot be edited afterward.
        </p>
        {submitError && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p role="alert">{submitError}</p>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setConfirmingSubmit(false)} disabled={isSubmittingFeedback}>
            Back
          </Button>
          <Button type="button" onClick={() => void handleConfirmSubmit()} disabled={isSubmittingFeedback}>
            {isSubmittingFeedback ? "Submitting…" : "Submit Feedback"}
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draftError && (
        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p role="alert">{draftError}</p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="feedback-recommendation">
          Overall Recommendation<span className="text-destructive"> *</span>
        </Label>
        <Select
          id="feedback-recommendation"
          value={recommendation}
          onChange={(e) => setRecommendation(e.target.value as InterviewFeedbackRecommendation | "")}
          disabled={isBusy}
          aria-invalid={!!errors.recommendation}
          aria-describedby={errors.recommendation ? "feedback-recommendation-error" : undefined}
        >
          <option value="">Select a recommendation…</option>
          {INTERVIEW_FEEDBACK_RECOMMENDATIONS.map((value) => (
            <option key={value} value={value}>
              {RECOMMENDATION_LABELS[value]}
            </option>
          ))}
        </Select>
        {errors.recommendation && (
          <p id="feedback-recommendation-error" role="alert" className="text-xs text-destructive">
            {errors.recommendation}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback-summary">
          Summary<span className="text-destructive"> *</span>
        </Label>
        <Textarea
          id="feedback-summary"
          rows={3}
          maxLength={MAX_TEXT_LENGTH}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          disabled={isBusy}
          aria-invalid={!!errors.summary}
          aria-describedby={errors.summary ? "feedback-summary-error" : undefined}
        />
        {errors.summary && (
          <p id="feedback-summary-error" role="alert" className="text-xs text-destructive">
            {errors.summary}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback-strengths">Strengths</Label>
        <Textarea
          id="feedback-strengths"
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={strengths}
          onChange={(e) => setStrengths(e.target.value)}
          disabled={isBusy}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback-concerns">Concerns</Label>
        <Textarea
          id="feedback-concerns"
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={concerns}
          onChange={(e) => setConcerns(e.target.value)}
          disabled={isBusy}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="feedback-private-notes">Private Notes</Label>
        <Textarea
          id="feedback-private-notes"
          rows={2}
          maxLength={MAX_TEXT_LENGTH}
          value={privateNotes}
          onChange={(e) => setPrivateNotes(e.target.value)}
          disabled={isBusy}
        />
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isBusy}>
          Close
        </Button>
        <Button type="button" variant="secondary" onClick={() => void handleSaveDraft()} disabled={isBusy}>
          {isSavingDraft ? "Saving…" : "Save Draft"}
        </Button>
        <Button type="button" onClick={handleSubmitClick} disabled={isBusy}>
          Submit Feedback
        </Button>
      </DialogFooter>
    </div>
  );
}

export function InterviewFeedbackForm({ open, onOpenChange, interviewId, ownFeedback, onSaved }: InterviewFeedbackFormProps) {
  const isReadOnly = ownFeedback?.status === "submitted";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isReadOnly ? "Your submitted feedback" : "Interview feedback"}</DialogTitle>
          {!isReadOnly && <DialogDescription>Share your assessment of this interview. You can save a draft and finish later.</DialogDescription>}
        </DialogHeader>

        {isReadOnly && ownFeedback ? (
          <div className="space-y-4">
            <SubmittedFeedbackView feedback={ownFeedback} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          open && (
            <EditableFeedbackForm
              interviewId={interviewId}
              ownFeedback={ownFeedback}
              onSaved={onSaved}
              onClose={() => onOpenChange(false)}
            />
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
