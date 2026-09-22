import { useEffect, useState } from "react";
import * as publicJobsApi from "@/services/api/publicJobs";
import { getPublicJobsListErrorMessage } from "@/lib/publicJobErrors";
import type { ListPublicJobsFilters, Pagination, PublicJob } from "@/types/publicJob";

interface UsePublicJobsResult {
  jobs: PublicJob[] | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Mirrors useApplications.ts's fetch-on-dependency-change pattern. Database
// read only, no auth — safe to call from a fully public page.
export function usePublicJobs(filters: ListPublicJobsFilters): UsePublicJobsResult {
  const { search, location, employmentType, department, page, limit } = filters;

  const [jobs, setJobs] = useState<PublicJob[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    publicJobsApi
      .listPublicJobs({ search, location, employmentType, department, page, limit }, controller.signal)
      .then(({ jobs: fetched, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setJobs(fetched);
        setPagination(fetchedPagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getPublicJobsListErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [search, location, employmentType, department, page, limit, refetchCount]);

  return { jobs, pagination, isLoading, error, refetch: () => setRefetchCount((c) => c + 1) };
}
