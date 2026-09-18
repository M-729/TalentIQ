import { useEffect, useState } from "react";
import * as publicJobsApi from "@/services/api/publicJobs";
import { ApiError } from "@/services/api/client";
import type { PublicJob } from "@/types/publicJob";

interface UsePublicJobResult {
  job: PublicJob | null;
  isLoading: boolean;
  error: string | null;
  // Covers nonexistent, draft, and closed jobs alike — the backend
  // collapses all three into the same 404, so the frontend has no way to
  // (and must not) distinguish them either.
  notFound: boolean;
  refetch: () => void;
}

export function usePublicJob(id: string | undefined): UsePublicJobResult {
  const [job, setJob] = useState<PublicJob | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    publicJobsApi
      .getPublicJob(id, controller.signal)
      .then(({ job: fetchedJob }) => {
        if (cancelled) return;
        setJob(fetchedJob);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id, refetchCount]);

  return { job, isLoading, error, notFound, refetch: () => setRefetchCount((c) => c + 1) };
}
