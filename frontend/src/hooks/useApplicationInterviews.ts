import { useCallback, useEffect, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getInterviewsListErrorMessage } from "@/lib/interviewErrors";
import type { Interview } from "@/types/interview";

interface UseApplicationInterviewsResult {
  interviews: Interview[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// The Application Detail page's Interviews section.
export function useApplicationInterviews(applicationId: string | undefined): UseApplicationInterviewsResult {
  const [interviews, setInterviews] = useState<Interview[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!applicationId) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    interviewsApi
      .listApplicationInterviews(applicationId, controller.signal)
      .then(({ interviews: fetched }) => {
        if (cancelled) return;
        setInterviews(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getInterviewsListErrorMessage(err));
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

  return { interviews, isLoading, error, refetch };
}
