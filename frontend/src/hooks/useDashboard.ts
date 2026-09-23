import { useCallback, useEffect, useState } from "react";
import * as dashboardApi from "@/services/api/dashboard";
import { ApiError } from "@/services/api/client";
import type { Dashboard } from "@/types/dashboard";

interface UseDashboardResult {
  dashboard: Dashboard | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDashboard(): UseDashboardResult {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    dashboardApi
      .getDashboard(controller.signal)
      .then((fetched) => {
        if (cancelled) return;
        setDashboard(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Dashboard could not be loaded. Please try again.");
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

  return { dashboard, isLoading, error, refetch };
}
