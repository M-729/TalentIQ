import { useCallback, useEffect, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getInterviewsListErrorMessage } from "@/lib/interviewErrors";
import type { InterviewListRow, InterviewStatus, Pagination } from "@/types/interview";

interface UseInterviewsParams {
  status?: InterviewStatus;
  jobId?: string;
  when?: "upcoming" | "past";
  page?: number;
  limit?: number;
}

interface UseInterviewsResult {
  interviews: InterviewListRow[] | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Company-wide list for the /interviews page. Filter params are accepted
// as individual scalars (not a single object) so they can be listed
// directly in the effect's dependency array — an object literal built
// fresh in the caller's render would otherwise retrigger the fetch every
// render regardless of whether any value actually changed.
export function useInterviews(params: UseInterviewsParams): UseInterviewsResult {
  const { status, jobId, when, page, limit } = params;
  const [interviews, setInterviews] = useState<InterviewListRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    interviewsApi
      .listInterviews({ status, jobId, when, page, limit }, controller.signal)
      .then(({ interviews: fetched, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setInterviews(fetched);
        setPagination(fetchedPagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getInterviewsListErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [status, jobId, when, page, limit, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { interviews, pagination, isLoading, error, refetch };
}
