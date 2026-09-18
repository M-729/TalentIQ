import { useCallback, useEffect, useState } from "react";
import * as jobsApi from "@/services/api/jobs";
import { ApiError } from "@/services/api/client";
import type { Job, JobStatus } from "@/types/job";

interface UseJobsResult {
  jobs: Job[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useJobs(status?: JobStatus): UseJobsResult {
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped by refetch() to re-trigger the effect below on demand.
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    jobsApi
      .listJobs(status, controller.signal)
      .then(({ jobs: fetchedJobs }) => {
        if (cancelled) return;
        setJobs(fetchedJobs);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Failed to load jobs. Please try again.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [status, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { jobs, isLoading, error, refetch };
}
