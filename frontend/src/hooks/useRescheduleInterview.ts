import { useCallback, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getRescheduleInterviewErrorMessage } from "@/lib/interviewErrors";
import type { Interview, RescheduleInterviewInput } from "@/types/interview";

interface UseRescheduleInterviewResult {
  run: (interviewId: string, input: RescheduleInterviewInput) => Promise<Interview | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// The local reschedule is always authoritative and returned here even
// when the backend's best-effort Google sync afterward failed — the
// returned Interview's calendar.sync_status reflects that; this hook
// never treats a sync failure as a mutation failure (see
// RescheduleInterviewDialog for how the UI distinguishes the two).
export function useRescheduleInterview(): UseRescheduleInterviewResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (interviewId: string, input: RescheduleInterviewInput): Promise<Interview | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { interview } = await interviewsApi.rescheduleInterview(interviewId, input);
        return interview;
      } catch (err) {
        setError(getRescheduleInterviewErrorMessage(err));
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
