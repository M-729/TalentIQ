import { useCallback, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getRetryOfferNotificationErrorMessage } from "@/lib/offerErrors";
import type { OfferNotification } from "@/types/offer";

interface UseRetryOfferNotificationResult {
  run: (offerId: string, notificationId: string) => Promise<OfferNotification | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Only a FAILED notification is retryable (the backend enforces this, 409
// otherwise); recipient/content are always reconstructed from the
// notification's own immutable snapshot server-side, never sent from here.
export function useRetryOfferNotification(): UseRetryOfferNotificationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (offerId: string, notificationId: string): Promise<OfferNotification | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { notification } = await offersApi.retryOfferNotification(offerId, notificationId);
        return notification;
      } catch (err) {
        setError(getRetryOfferNotificationErrorMessage(err));
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
