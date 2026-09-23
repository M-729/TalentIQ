import { useCallback, useEffect, useState } from "react";
import * as rejectionApi from "@/services/api/rejection";
import type { RejectionInfo } from "@/types/rejection";

interface UseRejectionInfoResult {
  rejection: RejectionInfo | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Only ever called once the Application Detail page already knows
// application.status === "rejected" — see OfferDecisionSection.tsx.
export function useRejectionInfo(applicationId: string | null): UseRejectionInfoResult {
  const [rejection, setRejection] = useState<RejectionInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!applicationId) {
      setRejection(null);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    rejectionApi
      .getRejectionInfo(applicationId, controller.signal)
      .then(({ rejection: fetched }) => {
        if (cancelled) return;
        setRejection(fetched);
      })
      .catch(() => {
        // Non-critical read (only supplements the "Rejected" state) — a
        // failure here never blocks the rest of the page; the section
        // simply renders without the email-status detail.
        if (cancelled) return;
        setError("Rejection details could not be loaded.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [applicationId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { rejection, isLoading, error, refetch };
}
