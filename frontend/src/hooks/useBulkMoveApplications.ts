import { useCallback, useState } from "react";
import * as hiringPipelineBoardApi from "@/services/api/hiringPipelineBoard";
import { getBulkMoveErrorMessage } from "@/lib/hiringPipelineBoardErrors";
import type { BulkMoveApplicationsInput } from "@/types/hiringPipelineBoard";

interface UseBulkMoveApplicationsResult {
  run: (jobId: string, input: BulkMoveApplicationsInput) => Promise<boolean>;
  isMoving: boolean;
  error: string | null;
  clearError: () => void;
}

// Mirrors useMoveApplicationHiringStep.ts exactly, for the bulk endpoint.
// The backend already handles tenant validation, same-Job stage
// validation, status transitions, the transaction, history, and
// concurrency for the WHOLE batch (see hiringPipelineBoard.service.ts's
// bulkMoveApplications) — nothing here duplicates any of that; this only
// calls the endpoint and maps its response to a safe success/failure
// signal, and blocks a double-submit while a request is already in flight.
export function useBulkMoveApplications(): UseBulkMoveApplicationsResult {
  const [isMoving, setIsMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (jobId: string, input: BulkMoveApplicationsInput): Promise<boolean> => {
      if (isMoving) return false;

      setIsMoving(true);
      setError(null);
      try {
        await hiringPipelineBoardApi.bulkMoveApplications(jobId, input);
        return true;
      } catch (err) {
        setError(getBulkMoveErrorMessage(err));
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
