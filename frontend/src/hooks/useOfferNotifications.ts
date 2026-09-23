import { useCallback, useEffect, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOffersListErrorMessage } from "@/lib/offerErrors";
import type { OfferNotification } from "@/types/offer";

interface UseOfferNotificationsResult {
  notifications: OfferNotification[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Mirrors useAssessmentNotifications.ts exactly, for an Offer's own
// candidate-facing email history.
export function useOfferNotifications(offerId: string | null): UseOfferNotificationsResult {
  const [notifications, setNotifications] = useState<OfferNotification[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!offerId) {
      setNotifications(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    offersApi
      .listOfferNotifications(offerId, controller.signal)
      .then(({ notifications: fetched }) => {
        if (cancelled) return;
        setNotifications(fetched);
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
  }, [offerId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { notifications, isLoading, error, refetch };
}
