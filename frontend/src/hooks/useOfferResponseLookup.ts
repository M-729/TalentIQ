import { useEffect, useState } from "react";
import * as offerResponseApi from "@/services/api/offerResponse";
import { getOfferResponseErrorMessage } from "@/lib/offerResponseErrors";
import type { OfferResponseResult } from "@/types/offerResponse";

interface UseOfferResponseLookupResult {
  result: OfferResponseResult | null;
  isLoading: boolean;
  error: string | null;
}

// Read-only page-load lookup — see services/api/offerResponse.ts's own
// doc comment on why this must never be anything but a safe, non-mutating
// read. `token` is null only when the page's own URL fragment had none
// (an even-more-invalid case than a garbage token), in which case this
// never even calls the API.
export function useOfferResponseLookup(token: string | null): UseOfferResponseLookupResult {
  const [result, setResult] = useState<OfferResponseResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setResult({ response_state: "invalid" });
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    offerResponseApi
      .lookupOfferResponse(token)
      .then((fetched) => {
        if (cancelled) return;
        setResult(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getOfferResponseErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return { result, isLoading, error };
}
