import { useCallback, useState } from "react";
import * as offerResponseApi from "@/services/api/offerResponse";
import { getOfferResponseErrorMessage } from "@/lib/offerResponseErrors";
import type { OfferResponseResult } from "@/types/offerResponse";

interface UseSubmitOfferResponseResult {
  run: (token: string, decision: "accepted" | "declined") => Promise<OfferResponseResult | null>;
  isSubmitting: boolean;
  error: string | null;
}

// The ONLY hook in this flow that may mutate an Offer — always an
// explicit "Confirm acceptance"/"Confirm decline" click, never fired on
// page load (see OfferResponsePage.tsx). Guards against a rapid double
// confirmation the same way every other mutation hook in this codebase
// does: a request already in flight makes a second call a no-op.
export function useSubmitOfferResponse(): UseSubmitOfferResponseResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (token: string, decision: "accepted" | "declined"): Promise<OfferResponseResult | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        return await offerResponseApi.respondToOfferResponse(token, decision);
      } catch (err) {
        setError(getOfferResponseErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  return { run, isSubmitting, error };
}
