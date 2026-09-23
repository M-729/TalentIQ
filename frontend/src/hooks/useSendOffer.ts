import { useCallback, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getSendOfferErrorMessage } from "@/lib/offerErrors";
import type { OfferNotification } from "@/types/offer";

interface UseSendOfferResult {
  run: (offerId: string) => Promise<OfferNotification | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Explicit "Send Offer" — never triggered automatically by creating/editing
// a draft (see this ticket's explicit Part 9 rule).
export function useSendOffer(): UseSendOfferResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (offerId: string): Promise<OfferNotification | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { notification } = await offersApi.sendOffer(offerId);
        return notification;
      } catch (err) {
        setError(getSendOfferErrorMessage(err));
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
