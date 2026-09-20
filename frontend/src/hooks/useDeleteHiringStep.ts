import { useCallback, useState } from "react";
import * as hiringStepsApi from "@/services/api/hiringSteps";
import { getHiringStepErrorMessage } from "@/lib/hiringStepErrors";

interface UseDeleteHiringStepResult {
  run: (stepId: string) => Promise<boolean>;
  isDeleting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useDeleteHiringStep(jobId: string | null): UseDeleteHiringStepResult {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (stepId: string): Promise<boolean> => {
      if (!jobId) return false;

      setIsDeleting(true);
      setError(null);
      try {
        await hiringStepsApi.deleteHiringStep(jobId, stepId);
        return true;
      } catch (err) {
        // Never auto-move applicants, clear their stage, or force-delete —
        // a 409 (stage in use) simply surfaces as a safe message here and
        // the stage stays exactly as it was.
        setError(getHiringStepErrorMessage(err, "delete"));
        return false;
      } finally {
        setIsDeleting(false);
      }
    },
    [jobId]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isDeleting, error, clearError };
}
