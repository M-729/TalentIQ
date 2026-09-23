import { useCallback, useState } from "react";
import * as companyInvitationApi from "@/services/api/companyInvitation";
import { getCompanyInvitationErrorMessage } from "@/lib/companyInvitationErrors";
import { useAuth } from "@/hooks/useAuth";
import type { CompanyInvitationResponseResult } from "@/types/companyInvitation";

interface UseAcceptCompanyInvitationResult {
  run: (token: string, fullName: string, password: string) => Promise<CompanyInvitationResponseResult | null>;
  isSubmitting: boolean;
  error: string | null;
}

// The ONLY hook in this flow that may mutate anything — always an
// explicit "Join company" click, never fired on page load (see
// AcceptInvitationPage.tsx). Guards against a rapid double submission the
// same way useSubmitOfferResponse.ts does. On a genuine acceptance, also
// establishes the new HR's session immediately (auto sign-in) via the
// same tokens the backend already issued — see auth-context.ts's
// hydrateSession.
export function useAcceptCompanyInvitation(): UseAcceptCompanyInvitationResult {
  const { hydrateSession } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (token: string, fullName: string, password: string): Promise<CompanyInvitationResponseResult | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const response = await companyInvitationApi.acceptCompanyInvitation(token, fullName, password);
        if (response.state === "accepted" && response.accessToken && response.user) {
          hydrateSession(response.accessToken, response.user);
        }
        return response;
      } catch (err) {
        setError(getCompanyInvitationErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, hydrateSession]
  );

  return { run, isSubmitting, error };
}
