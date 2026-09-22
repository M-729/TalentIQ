import { useCallback, useEffect, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getAssessmentsListErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { AssessmentNotification } from "@/types/applicationAssessment";

interface UseAssessmentNotificationsResult {
  notifications: AssessmentNotification[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Mirrors useInterviewNotifications.ts exactly, for an assessment's own
// candidate-invitation history.
export function useAssessmentNotifications(assessmentId: string | null): UseAssessmentNotificationsResult {
  const [notifications, setNotifications] = useState<AssessmentNotification[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!assessmentId) {
      setNotifications(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    applicationAssessmentsApi
      .listAssessmentNotifications(assessmentId, controller.signal)
      .then(({ notifications: fetched }) => {
        if (cancelled) return;
        setNotifications(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getAssessmentsListErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [assessmentId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { notifications, isLoading, error, refetch };
}
