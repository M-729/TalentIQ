import { useCallback, useEffect, useState } from "react";
import * as screeningsApi from "@/services/api/screenings";
import { ApiError } from "@/services/api/client";
import { getGenericApiErrorMessage } from "@/lib/apiErrorMessage";
import type { Screening, ScreeningStatus } from "@/types/screening";

interface UseLatestScreeningResult {
  screening: Screening | null;
  /** Defaults to "not_started" until the first fetch resolves — matches the safe legacy fallback the backend itself uses. */
  status: ScreeningStatus;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
}

// Database read only (GET .../screenings/latest) — never triggers AI. Runs
// once on mount (and again if `applicationId` changes or refetch() is
// called), matching useJob.ts's exact pattern. `screening` is deliberately
// NOT reset to null at the start of a refetch, so a page re-fetching after
// a successful "Re-run Screening" keeps the previous result visible until
// the new data actually arrives.
export function useLatestScreening(applicationId: string | undefined): UseLatestScreeningResult {
  const [screening, setScreening] = useState<Screening | null>(null);
  const [status, setStatus] = useState<ScreeningStatus>("not_started");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!applicationId) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    screeningsApi
      .getLatestScreening(applicationId, controller.signal)
      .then(({ screening: fetched, status: fetchedStatus }) => {
        if (cancelled) return;
        setScreening(fetched);
        setStatus(fetchedStatus);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(getGenericApiErrorMessage(err, "Failed to load the latest screening. Please try again."));
        }
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

  return { screening, status, isLoading, error, notFound, refetch };
}
