import { useCallback, useEffect, useState } from "react";
import * as applicationsApi from "@/services/api/applications";
import { getApplicationsListErrorMessage } from "@/lib/applicationErrors";
import type { ApplicationListRow, ApplicationStatus, Pagination } from "@/types/application";

export interface UseApplicationsFilters {
  search?: string;
  jobId?: string;
  status?: ApplicationStatus;
  page: number;
  limit: number;
}

interface UseApplicationsResult {
  applications: ApplicationListRow[] | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Database read only — this list is never the trigger for an AI call.
// Mirrors useJobs.ts's fetch-on-mount/dependency-change pattern.
export function useApplications(filters: UseApplicationsFilters): UseApplicationsResult {
  const { search, jobId, status, page, limit } = filters;

  const [applications, setApplications] = useState<ApplicationListRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    // Rebuilt from the individually-destructured primitives above (not the
    // `filters` object itself) so every value this effect actually reads
    // is explicitly in its own dependency array — `filters` is a fresh
    // object literal every render in the caller, so depending on it
    // directly would refetch on every render regardless of whether any
    // filter actually changed.
    applicationsApi
      .getApplications({ search, jobId, status, page, limit }, controller.signal)
      .then(({ applications: fetched, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setApplications(fetched);
        setPagination(fetchedPagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getApplicationsListErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [search, jobId, status, page, limit, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { applications, pagination, isLoading, error, refetch };
}
