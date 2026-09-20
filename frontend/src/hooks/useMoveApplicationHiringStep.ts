import { useCallback, useState } from "react";
import * as hiringPipelineBoardApi from "@/services/api/hiringPipelineBoard";
import { getMoveErrorMessage } from "@/lib/hiringPipelineBoardErrors";
import type { MoveApplicationHiringStepInput } from "@/types/hiringPipelineBoard";

interface UseMoveApplicationHiringStepResult {
  run: (applicationId: string, input: MoveApplicationHiringStepInput) => Promise<boolean>;
  isMoving: boolean;
  error: string | null;
  clearError: () => void;
}

// Not scoped to a Job or Application — applicationId is passed per call.
// The backend endpoint already handles tenant validation, same-Job stage
// validation, status transitions, the transaction, history, and
// concurrency (see stageTransition.service.ts) — nothing here duplicates
// any of that; this only calls the endpoint and maps its response to a
// safe success/failure signal.
export function useMoveApplicationHiringStep(): UseMoveApplicationHiringStepResult {
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (applicationId: string, input: MoveApplicationHiringStepInput): Promise<boolean> => {
      // Blocks a duplicate concurrent move from the same card — the modal
      // dialog itself already prevents most of this (background content is
      // inert while open), this is the defense-in-depth guard for a rapid
      // double-click on the submit button.
      if (isMoving) return false;

      setIsMoving(true);
      setError(null);
      try {
        await hiringPipelineBoardApi.moveApplicationToHiringStep(applicationId, input);
        return true;
      } catch (err) {
        setError(getMoveErrorMessage(err));
        return false;
      } finally {
        setIsMoving(false);
      }
    },
    [isMoving]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isMoving, error, clearError };
}
