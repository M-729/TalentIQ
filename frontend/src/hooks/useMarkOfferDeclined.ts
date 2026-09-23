import { useCallback, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOfferTransitionErrorMessage } from "@/lib/offerErrors";
import type { Offer } from "@/types/offer";

interface UseMarkOfferDeclinedResult {
  run: (offerId: string) => Promise<Offer | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Same HR-recorded-response model as useMarkOfferAccepted, for the other
// outcome.
export function useMarkOfferDeclined(): UseMarkOfferDeclinedResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (offerId: string): Promise<Offer | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { offer } = await offersApi.markOfferDeclined(offerId);
        return offer;
      } catch (err) {
        setError(getOfferTransitionErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isSubmitting, error, clearError };
}
