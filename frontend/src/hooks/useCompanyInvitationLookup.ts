import { useEffect, useState } from "react";
import * as companyInvitationApi from "@/services/api/companyInvitation";
import { getCompanyInvitationErrorMessage } from "@/lib/companyInvitationErrors";
import type { CompanyInvitationResponseResult } from "@/types/companyInvitation";

interface UseCompanyInvitationLookupResult {
  result: CompanyInvitationResponseResult | null;
  isLoading: boolean;
  error: string | null;
}

// Read-only page-load lookup — mirrors useOfferResponseLookup.ts exactly.
// `token` is null only when the page's own URL fragment had none, in
// which case this never even calls the API.
export function useCompanyInvitationLookup(token: string | null): UseCompanyInvitationLookupResult {
  const [result, setResult] = useState<CompanyInvitationResponseResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setResult({ state: "invalid" });
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    companyInvitationApi
      .lookupCompanyInvitation(token)
      .then((fetched) => {
        if (cancelled) return;
        setResult(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getCompanyInvitationErrorMessage(err));
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
