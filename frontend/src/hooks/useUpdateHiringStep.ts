import { useCallback, useState } from "react";
import * as hiringStepsApi from "@/services/api/hiringSteps";
import { getHiringStepErrorMessage } from "@/lib/hiringStepErrors";
import type { HiringStep, UpdateHiringStepInput } from "@/types/hiringStep";

interface UseUpdateHiringStepResult {
  run: (stepId: string, input: UpdateHiringStepInput) => Promise<HiringStep | null>;
  isUpdating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useUpdateHiringStep(jobId: string | null): UseUpdateHiringStepResult {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (stepId: string, input: UpdateHiringStepInput): Promise<HiringStep | null> => {
      if (!jobId) return null;

      setIsUpdating(true);
      setError(null);
      try {
        const { step } = await hiringStepsApi.updateHiringStep(jobId, stepId, input);
        return step;
      } catch (err) {
        setError(getHiringStepErrorMessage(err, "update"));
        return null;
      } finally {
        setIsUpdating(false);
      }
    },
    [jobId]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isUpdating, error, clearError };
}
