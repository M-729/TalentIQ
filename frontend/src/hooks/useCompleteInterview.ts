import { useCallback, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getCompleteInterviewErrorMessage } from "@/lib/interviewErrors";
import type { Interview } from "@/types/interview";

interface UseCompleteInterviewResult {
  run: (interviewId: string) => Promise<Interview | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Same "guard against re-entrancy while a request is pending" contract as
// useRescheduleInterview/useCancelInterview.
export function useCompleteInterview(): UseCompleteInterviewResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (interviewId: string): Promise<Interview | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { interview } = await interviewsApi.completeInterview(interviewId);
        return interview;
      } catch (err) {
        setError(getCompleteInterviewErrorMessage(err));
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
