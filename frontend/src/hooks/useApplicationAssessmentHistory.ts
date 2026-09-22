import { useCallback, useEffect, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getAssessmentErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { AssessmentHistoryItem } from "@/types/applicationAssessment";

interface UseApplicationAssessmentHistoryResult {
  /** Every assessment record this Application has ever had, newest first — an empty array (never null while loaded) when none exist yet. */
  assessments: AssessmentHistoryItem[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// A single request covers both "what's the active assessment for the
// current stage" (the one item with is_current: true, if any) and "what
// historical assessments exist from earlier stages" — see
// ApplicationAssessmentSection.tsx, which derives both from this one
// fetch rather than issuing a second request for the current-stage record.
export function useApplicationAssessmentHistory(applicationId: string | null): UseApplicationAssessmentHistoryResult {
  const [assessments, setAssessments] = useState<AssessmentHistoryItem[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!applicationId) {
      setAssessments(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    applicationAssessmentsApi
      .getAssessmentHistoryForApplication(applicationId, controller.signal)
      .then(({ assessments: fetched }) => {
        if (cancelled) return;
        setAssessments(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getAssessmentErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applicationId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { assessments, isLoading, error, refetch };
}
