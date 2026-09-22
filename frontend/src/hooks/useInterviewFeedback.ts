import { useCallback, useEffect, useState } from "react";
import * as interviewFeedbackApi from "@/services/api/interviewFeedback";
import { getInterviewFeedbackListErrorMessage } from "@/lib/interviewFeedbackErrors";
import type { InterviewFeedbackList } from "@/types/interviewFeedback";

interface UseInterviewFeedbackResult {
  data: InterviewFeedbackList | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Only meaningful once an Interview is completed, but safe to call at any
// status — a scheduled/cancelled Interview simply returns an empty roster
// (see backend interviewFeedback.service.ts).
export function useInterviewFeedback(interviewId: string | undefined): UseInterviewFeedbackResult {
  const [data, setData] = useState<InterviewFeedbackList | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!interviewId) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    interviewFeedbackApi
      .listInterviewFeedback(interviewId, controller.signal)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getInterviewFeedbackListErrorMessage(err));
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

  return { data, isLoading, error, refetch };
}
