import { useCallback, useState } from "react";
import * as screeningsApi from "@/services/api/screenings";
import { getScreeningErrorMessage } from "@/lib/screeningErrors";
import type { Screening } from "@/types/screening";

interface UseCreateScreeningResult {
  run: () => Promise<Screening | null>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
}

// The only place in this feature that triggers a real AI call — always in
// direct response to a user clicking a button (Run AI Screening / a
// confirmed Re-run Screening), never from a mount effect. On failure,
// resolves to null and exposes a safe message via `error`; it never
// throws, so a caller can't accidentally let a rejection clear an
// already-rendered previous result.
export function useCreateScreening(applicationId: string | undefined): UseCreateScreeningResult {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (): Promise<Screening | null> => {
    if (!applicationId) return null;

    setIsCreating(true);
    setError(null);
    try {
      const { screening } = await screeningsApi.createScreening(applicationId);
      return screening;
    } catch (err) {
      setError(getScreeningErrorMessage(err));
      return null;
    } finally {
      setIsCreating(false);
    }
  }, [applicationId]);

  const clearError = useCallback(() => setError(null), []);

  return { run, isCreating, error, clearError };
}
