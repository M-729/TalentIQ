import { useCallback, useState } from "react";
import * as interviewFeedbackApi from "@/services/api/interviewFeedback";
import { getSaveFeedbackDraftErrorMessage } from "@/lib/interviewFeedbackErrors";
import type { InterviewFeedback, SaveFeedbackDraftInput } from "@/types/interviewFeedback";

interface UseSaveFeedbackDraftResult {
  run: (interviewId: string, input: SaveFeedbackDraftInput) => Promise<InterviewFeedback | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useSaveFeedbackDraft(): UseSaveFeedbackDraftResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (interviewId: string, input: SaveFeedbackDraftInput): Promise<InterviewFeedback | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { feedback } = await interviewFeedbackApi.saveOwnFeedbackDraft(interviewId, input);
        return feedback;
      } catch (err) {
        setError(getSaveFeedbackDraftErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isSubmitting, error, clearError };
}
