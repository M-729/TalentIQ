import { useEffect, useState } from "react";
import * as jobsApi from "@/services/api/jobs";
import { ApiError } from "@/services/api/client";
import { getGenericApiErrorMessage } from "@/lib/apiErrorMessage";
import type { Job } from "@/types/job";

interface UseJobResult {
  job: Job | null;
  isLoading: boolean;
  error: string | null;
  notFound: boolean;
}

export function useJob(id: string | undefined): UseJobResult {
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);
    setNotFound(false);

    jobsApi
      .getJob(id, controller.signal)
      .then(({ job: fetchedJob }) => {
        if (cancelled) return;
        setJob(fetchedJob);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setError(getGenericApiErrorMessage(err, "Failed to load this job. Please try again."));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [id]);

  return { job, isLoading, error, notFound };
}
