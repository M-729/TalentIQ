import { useCallback, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getScheduleInterviewErrorMessage } from "@/lib/interviewErrors";
import type { Interview, ScheduleInterviewInput } from "@/types/interview";

interface UseScheduleInterviewResult {
  run: (applicationId: string, input: ScheduleInterviewInput) => Promise<Interview | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Always an explicit HR action, invoked only from ScheduleInterviewDialog's
// submit handler — never called on a stage move.
export function useScheduleInterview(): UseScheduleInterviewResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (applicationId: string, input: ScheduleInterviewInput): Promise<Interview | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { interview } = await interviewsApi.scheduleInterview(applicationId, input);
        return interview;
      } catch (err) {
        setError(getScheduleInterviewErrorMessage(err));
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
