import { useCallback, useEffect, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { ApiError } from "@/services/api/client";
import { getInterviewDetailErrorMessage } from "@/lib/interviewErrors";
import type { InterviewDetail } from "@/types/interview";

interface UseInterviewResult {
  interview: InterviewDetail | null;
  /** Merges an updated Interview (from a reschedule/cancel/calendar mutation response, which never includes candidate/job) into the current detail state, preserving the immutable candidate/job fields already loaded. */
  applyUpdate: (updated: Partial<InterviewDetail>) => void;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
}

// Mirrors useApplication.ts's exact pattern, including the 404 -> notFound distinction.
export function useInterview(interviewId: string | undefined): UseInterviewResult {
  const [interview, setInterview] = useState<InterviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!interviewId) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    interviewsApi
      .getInterview(interviewId, controller.signal)
      .then(({ interview: fetched }) => {
        if (cancelled) return;
        setInterview(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(getInterviewDetailErrorMessage(err));
        }
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

  const applyUpdate = useCallback((updated: Partial<InterviewDetail>) => {
    setInterview((prev) => (prev ? { ...prev, ...updated } : prev));
  }, []);

  return { interview, applyUpdate, isLoading, error, notFound, refetch };
}
