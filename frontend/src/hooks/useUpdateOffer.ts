import { useCallback, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOfferErrorMessage } from "@/lib/offerErrors";
import type { Offer, UpdateOfferInput } from "@/types/offer";

interface UseUpdateOfferResult {
  run: (offerId: string, input: UpdateOfferInput) => Promise<Offer | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Draft-only on the backend — locked once sent (see offer.service.ts's updateOffer).
export function useUpdateOffer(): UseUpdateOfferResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (offerId: string, input: UpdateOfferInput): Promise<Offer | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { offer } = await offersApi.updateOffer(offerId, input);
        return offer;
      } catch (err) {
        setError(getOfferErrorMessage(err));
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
