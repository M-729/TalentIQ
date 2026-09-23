import { useCallback, useState } from "react";
import * as rejectionApi from "@/services/api/rejection";
import { getRetryRejectionEmailErrorMessage } from "@/lib/rejectionErrors";
import type { RejectionNotification } from "@/types/rejection";

interface UseRetryRejectionEmailResult {
  run: (applicationId: string) => Promise<RejectionNotification | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useRetryRejectionEmail(): UseRetryRejectionEmailResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (applicationId: string): Promise<RejectionNotification | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { notification } = await rejectionApi.retryRejectionEmail(applicationId);
        return notification;
      } catch (err) {
        setError(getRetryRejectionEmailErrorMessage(err));
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
