import { useCallback, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getCancelInterviewErrorMessage } from "@/lib/interviewErrors";
import type { CancelInterviewInput, Interview } from "@/types/interview";

interface UseCancelInterviewResult {
  run: (interviewId: string, input: CancelInterviewInput) => Promise<Interview | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Same "local cancellation is authoritative, Google sync is best-effort"
// contract as useRescheduleInterview.
export function useCancelInterview(): UseCancelInterviewResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (interviewId: string, input: CancelInterviewInput): Promise<Interview | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { interview } = await interviewsApi.cancelInterview(interviewId, input);
        return interview;
      } catch (err) {
        setError(getCancelInterviewErrorMessage(err));
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
