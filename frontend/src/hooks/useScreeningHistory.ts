import { useCallback, useEffect, useState } from "react";
import * as screeningsApi from "@/services/api/screenings";
import { ApiError } from "@/services/api/client";
import type { Screening } from "@/types/screening";

interface UseScreeningHistoryResult {
  screenings: Screening[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Database read only (GET .../screenings) — never triggers AI, never
// recalculates anything. The backend already returns newest first.
export function useScreeningHistory(applicationId: string | undefined): UseScreeningHistoryResult {
  const [screenings, setScreenings] = useState<Screening[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!applicationId) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    screeningsApi
      .getScreeningHistory(applicationId, controller.signal)
      .then(({ screenings: fetched }) => {
        if (cancelled) return;
        setScreenings(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load screening history. Please try again.");
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

  return { screenings, isLoading, error, refetch };
}
