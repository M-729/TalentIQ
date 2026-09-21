import { useCallback, useEffect, useState } from "react";
import * as interviewNotificationsApi from "@/services/api/interviewNotifications";
import { getInterviewNotificationsErrorMessage } from "@/lib/interviewNotificationErrors";
import type { InterviewNotification } from "@/types/interviewNotification";

interface UseInterviewNotificationsResult {
  notifications: InterviewNotification[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// The Interview Detail page's "Candidate Notification" section.
export function useInterviewNotifications(interviewId: string | undefined): UseInterviewNotificationsResult {
  const [notifications, setNotifications] = useState<InterviewNotification[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!interviewId) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    interviewNotificationsApi
      .listInterviewNotifications(interviewId, controller.signal)
      .then(({ notifications: fetched }) => {
        if (cancelled) return;
        setNotifications(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getInterviewNotificationsErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [interviewId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { notifications, isLoading, error, refetch };
}
