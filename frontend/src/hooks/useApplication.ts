import { useCallback, useEffect, useState } from "react";
import * as applicationsApi from "@/services/api/applications";
import { ApiError } from "@/services/api/client";
import { getApplicationDetailErrorMessage } from "@/lib/applicationErrors";
import type { ApplicationDetail } from "@/types/application";

interface UseApplicationResult {
  application: ApplicationDetail | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
  refetch: () => void;
}

// Database read only — mirrors useJob.ts's exact pattern, including the
// 404 -> notFound distinction (rendered as "This application is
// unavailable." by callers, never a raw backend message).
export function useApplication(applicationId: string | undefined): UseApplicationResult {
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
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

    applicationsApi
      .getApplication(applicationId, controller.signal)
      .then(({ application: fetched }) => {
        if (cancelled) return;
        setApplication(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(getApplicationDetailErrorMessage(err));
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

  return { application, isLoading, error, notFound, refetch };
}
