import { useCallback, useState } from "react";
import * as rejectionApi from "@/services/api/rejection";
import { getRejectApplicationErrorMessage } from "@/lib/rejectionErrors";
import type { ApplicationDetail } from "@/types/application";
import type { RejectApplicationInput, RejectionNotification } from "@/types/rejection";

interface UseRejectApplicationResult {
  run: (
    applicationId: string,
    input: RejectApplicationInput
  ) => Promise<{ application: ApplicationDetail; notification: RejectionNotification | null } | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useRejectApplication(): UseRejectApplicationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (applicationId: string, input: RejectApplicationInput) => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        return await rejectionApi.rejectApplication(applicationId, input);
      } catch (err) {
        setError(getRejectApplicationErrorMessage(err));
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
