import { useCallback, useEffect, useState } from "react";
import * as hiringStepsApi from "@/services/api/hiringSteps";
import { getHiringStepErrorMessage } from "@/lib/hiringStepErrors";
import type { HiringStep } from "@/types/hiringStep";

interface UseHiringStepsResult {
  steps: HiringStep[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  /** Local, immediate update after a mutation that already returns the full fresh list (reorder) — avoids an extra round trip. */
  setSteps: (steps: HiringStep[]) => void;
}

// Never fetches without a Job id — pipeline configuration belongs to
// exactly one Job, and there is nothing to fetch until one is selected.
export function useHiringSteps(jobId: string | null): UseHiringStepsResult {
  const [steps, setSteps] = useState<HiringStep[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!jobId) {
      setSteps(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    hiringStepsApi
      .getHiringSteps(jobId, controller.signal)
      .then(({ steps: fetchedSteps }) => {
        if (cancelled) return;
        setSteps(fetchedSteps);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getHiringStepErrorMessage(err, "fetch"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { steps, isLoading, error, refetch, setSteps };
}
