import { useCallback, useState } from "react";
import * as hiringStepsApi from "@/services/api/hiringSteps";
import { getHiringStepErrorMessage } from "@/lib/hiringStepErrors";
import type { HiringStep } from "@/types/hiringStep";

interface UseReorderHiringStepsResult {
  run: (orderedStepIds: string[]) => Promise<HiringStep[] | null>;
  isReordering: boolean;
  error: string | null;
  clearError: () => void;
}

// isReordering doubles as the "no duplicate simultaneous reorder requests"
// guard — run() below refuses to start a second request while one is
// still in flight, and callers disable Move Up/Down using this same flag.
export function useReorderHiringSteps(jobId: string | null): UseReorderHiringStepsResult {
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (orderedStepIds: string[]): Promise<HiringStep[] | null> => {
      if (!jobId || isReordering) return null;

      setIsReordering(true);
      setError(null);
      try {
        // The backend returns the full, freshly-ordered step list — used
        // directly as the new UI state, no extra refetch needed. The UI
        // order is only ever updated from this response, never optimistically
        // beforehand, so a failed request leaves the previous (correct)
        // order untouched.
        const { steps } = await hiringStepsApi.reorderHiringSteps(jobId, orderedStepIds);
        return steps;
      } catch (err) {
        setError(getHiringStepErrorMessage(err, "reorder"));
        return null;
      } finally {
        setIsReordering(false);
      }
    },
    [jobId, isReordering]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isReordering, error, clearError };
}
