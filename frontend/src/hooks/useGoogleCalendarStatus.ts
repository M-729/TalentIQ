import { useCallback, useEffect, useState } from "react";
import * as googleCalendarApi from "@/services/api/googleCalendarIntegration";
import { getIntegrationStatusErrorMessage } from "@/lib/googleCalendarIntegrationErrors";
import type { GoogleCalendarStatus } from "@/types/googleCalendar";

interface UseGoogleCalendarStatusResult {
  status: GoogleCalendarStatus | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useGoogleCalendarStatus(): UseGoogleCalendarStatusResult {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    googleCalendarApi
      .getGoogleCalendarStatus(controller.signal)
      .then((fetched) => {
        if (cancelled) return;
        setStatus(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getIntegrationStatusErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { status, isLoading, error, refetch };
}
