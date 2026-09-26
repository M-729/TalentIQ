import { useCallback, useEffect, useState } from "react";
import * as emailActivityApi from "@/services/api/emailActivity";
import { getGenericApiErrorMessage } from "@/lib/apiErrorMessage";
import type { Pagination } from "@/types/application";
import type { EmailActivityRow, ListEmailActivityFilters } from "@/types/emailActivity";

interface UseEmailActivityListResult {
  emails: EmailActivityRow[] | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useEmailActivityList(filters: ListEmailActivityFilters): UseEmailActivityListResult {
  const { search, type, status, page, limit } = filters;
  const [emails, setEmails] = useState<EmailActivityRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    emailActivityApi
      .listEmailActivity({ search, type, status, page, limit }, controller.signal)
      .then(({ emails: fetched, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setEmails(fetched);
        setPagination(fetchedPagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getGenericApiErrorMessage(err, "Email activity could not be loaded. Please try again."));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [search, type, status, page, limit, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { emails, pagination, isLoading, error, refetch };
}
