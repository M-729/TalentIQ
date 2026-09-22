import { useCallback, useEffect, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getAssessmentsListErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { AssessmentListRow, ListAssessmentsFilters, Pagination } from "@/types/applicationAssessment";

interface UseApplicationAssessmentsListResult {
  assessments: AssessmentListRow[] | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Company-wide list for the /assessments page. Filter params are accepted
// as individual scalars (not a single object) so they can be listed
// directly in the effect's dependency array — mirrors useApplications.ts/
// useInterviews.ts's own established convention exactly.
export function useApplicationAssessmentsList(filters: ListAssessmentsFilters): UseApplicationAssessmentsListResult {
  const { jobId, status, search, page, limit } = filters;
  const [assessments, setAssessments] = useState<AssessmentListRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    applicationAssessmentsApi
      .listAssessments({ jobId, status, search, page, limit }, controller.signal)
      .then(({ assessments: fetched, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setAssessments(fetched);
        setPagination(fetchedPagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getAssessmentsListErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId, status, search, page, limit, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { assessments, pagination, isLoading, error, refetch };
}
