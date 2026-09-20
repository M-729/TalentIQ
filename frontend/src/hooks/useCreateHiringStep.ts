import { useCallback, useState } from "react";
import * as hiringStepsApi from "@/services/api/hiringSteps";
import { getHiringStepErrorMessage } from "@/lib/hiringStepErrors";
import type { CreateHiringStepInput, HiringStep } from "@/types/hiringStep";

interface UseCreateHiringStepResult {
  run: (input: CreateHiringStepInput) => Promise<HiringStep | null>;
  isCreating: boolean;
  error: string | null;
  clearError: () => void;
}

export function useCreateHiringStep(jobId: string | null): UseCreateHiringStepResult {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (input: CreateHiringStepInput): Promise<HiringStep | null> => {
      if (!jobId) return null;

      setIsCreating(true);
      setError(null);
      try {
        const { step } = await hiringStepsApi.createHiringStep(jobId, input);
        return step;
      } catch (err) {
        setError(getHiringStepErrorMessage(err, "create"));
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [jobId]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isCreating, error, clearError };
}
