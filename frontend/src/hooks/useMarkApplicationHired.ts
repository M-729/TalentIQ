import { useCallback, useState } from "react";
import * as offersApi from "@/services/api/offers";
import { getOfferTransitionErrorMessage } from "@/lib/offerErrors";
import type { ApplicationDetail } from "@/types/application";
import type { Offer } from "@/types/offer";

interface UseMarkApplicationHiredResult {
  run: (offerId: string) => Promise<{ application: ApplicationDetail; offer: Offer } | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// The one explicit transition that completes the hiring workflow — only
// allowed when Offer.status === "accepted" (see this ticket's explicit
// Part 12/13 "Accepted does NOT automatically Hire" rule).
export function useMarkApplicationHired(): UseMarkApplicationHiredResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (offerId: string): Promise<{ application: ApplicationDetail; offer: Offer } | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        return await offersApi.markApplicationHired(offerId);
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
