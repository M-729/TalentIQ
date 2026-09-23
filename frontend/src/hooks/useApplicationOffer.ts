import { useCallback, useEffect, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOfferErrorMessage } from "@/lib/offerErrors";
import type { Offer } from "@/types/offer";

interface UseApplicationOfferResult {
  offer: Offer | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// The Application Detail page's current (live, non-withdrawn) Offer read —
// null (never 404) when nothing live exists yet, matching
// useApplicationAssessment-style singular-record hooks in this codebase.
export function useApplicationOffer(applicationId: string): UseApplicationOfferResult {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    offersApi
      .getCurrentOfferForApplication(applicationId, controller.signal)
      .then(({ offer: fetched }) => {
        if (cancelled) return;
        setOffer(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getOfferErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applicationId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { offer, isLoading, error, refetch };
}
