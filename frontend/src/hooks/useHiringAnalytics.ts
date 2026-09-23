import { useCallback, useEffect, useState } from "react";
import * as hiringAnalyticsApi from "@/services/api/hiringAnalytics";
import { ApiError } from "@/services/api/client";
import type { AnalyticsRange, HiringAnalytics } from "@/types/hiringAnalytics";

interface UseHiringAnalyticsResult {
  analytics: HiringAnalytics | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useHiringAnalytics(range: AnalyticsRange, jobId?: string): UseHiringAnalyticsResult {
  const [analytics, setAnalytics] = useState<HiringAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    hiringAnalyticsApi
      .getHiringAnalytics({ range, jobId }, controller.signal)
      .then((fetched) => {
        if (cancelled) return;
        setAnalytics(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Analytics could not be loaded. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [range, jobId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { analytics, isLoading, error, refetch };
}
