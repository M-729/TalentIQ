import { useCallback, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getRetryAssessmentNotificationErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { AssessmentNotification } from "@/types/applicationAssessment";

interface UseRetryAssessmentNotificationResult {
  run: (assessmentId: string, notificationId: string) => Promise<AssessmentNotification | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Retries the SAME row in place — only ever valid for a failed
// notification (the backend enforces this). Distinct from
// useSendAssessmentInvitation's "Send Again", which always creates a new one.
export function useRetryAssessmentNotification(): UseRetryAssessmentNotificationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (assessmentId: string, notificationId: string): Promise<AssessmentNotification | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { notification } = await applicationAssessmentsApi.retryAssessmentNotification(assessmentId, notificationId);
        return notification;
      } catch (err) {
        setError(getRetryAssessmentNotificationErrorMessage(err));
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
