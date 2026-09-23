import { useCallback, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOfferErrorMessage } from "@/lib/offerErrors";
import type { CreateOfferInput, Offer } from "@/types/offer";

interface UseCreateOfferResult {
  run: (applicationId: string, input: CreateOfferInput) => Promise<Offer | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateOffer(): UseCreateOfferResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (applicationId: string, input: CreateOfferInput): Promise<Offer | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { offer } = await offersApi.createOffer(applicationId, input);
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
