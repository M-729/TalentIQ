import { useCallback, useState } from "react";
import * as interviewNotificationsApi from "@/services/api/interviewNotifications";
import { getRetryNotificationErrorMessage } from "@/lib/interviewNotificationErrors";
import type { InterviewNotification } from "@/types/interviewNotification";

interface UseRetryInterviewNotificationResult {
  run: (notificationId: string) => Promise<InterviewNotification | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useRetryInterviewNotification(): UseRetryInterviewNotificationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (notificationId: string): Promise<InterviewNotification | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { notification } = await interviewNotificationsApi.retryInterviewNotification(notificationId);
        return notification;
      } catch (err) {
        setError(getRetryNotificationErrorMessage(err));
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
