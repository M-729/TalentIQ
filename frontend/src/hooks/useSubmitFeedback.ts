import { useCallback, useState } from "react";
import * as interviewFeedbackApi from "@/services/api/interviewFeedback";
import { getSubmitFeedbackErrorMessage } from "@/lib/interviewFeedbackErrors";
import type { InterviewFeedback, SubmitFeedbackInput } from "@/types/interviewFeedback";

interface UseSubmitFeedbackResult {
  run: (interviewId: string, input: SubmitFeedbackInput) => Promise<InterviewFeedback | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Submission is treated as immutable once it succeeds (see backend
// interviewFeedback.service.ts's submitFeedback) — this hook has no retry-
// after-success path, only the usual pending/error guard.
export function useSubmitFeedback(): UseSubmitFeedbackResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (interviewId: string, input: SubmitFeedbackInput): Promise<InterviewFeedback | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { feedback } = await interviewFeedbackApi.submitOwnFeedback(interviewId, input);
        return feedback;
      } catch (err) {
        setError(getSubmitFeedbackErrorMessage(err));
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
