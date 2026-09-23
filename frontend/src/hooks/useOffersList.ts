import { useCallback, useEffect, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOffersListErrorMessage } from "@/lib/offerErrors";
import type { ListOffersFilters, OfferListRow } from "@/types/offer";
import type { Pagination } from "@/types/application";

interface UseOffersListResult {
  offers: OfferListRow[] | null;
  pagination: Pagination | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Company-wide list for the /offers page — mirrors
// useApplicationAssessmentsList.ts exactly. Filter params are accepted as
// individual scalars (not a single object) so they can be listed directly
// in the effect's dependency array.
export function useOffersList(filters: ListOffersFilters): UseOffersListResult {
  const { jobId, status, search, page, limit } = filters;
  const [offers, setOffers] = useState<OfferListRow[] | null>(null);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    offersApi
      .listOffers({ jobId, status, search, page, limit }, controller.signal)
      .then(({ offers: fetched, pagination: fetchedPagination }) => {
        if (cancelled) return;
        setOffers(fetched);
        setPagination(fetchedPagination);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getOffersListErrorMessage(err));
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

  return { offers, pagination, isLoading, error, refetch };
}
