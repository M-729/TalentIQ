import { useCallback, useEffect, useState } from "react";
import * as hiringPipelineBoardApi from "@/services/api/hiringPipelineBoard";
import { getBoardErrorMessage } from "@/lib/hiringPipelineBoardErrors";
import type { HiringPipelineBoard } from "@/types/hiringPipelineBoard";

interface UseHiringPipelineBoardResult {
  board: HiringPipelineBoard | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Never fetches without a Job id — the board belongs to exactly one Job,
// mirroring useHiringSteps.ts's own guard.
export function useHiringPipelineBoard(jobId: string | null): UseHiringPipelineBoardResult {
  const [board, setBoard] = useState<HiringPipelineBoard | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    if (!jobId) {
      setBoard(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    hiringPipelineBoardApi
      .getHiringPipelineBoard(jobId, controller.signal)
      .then((fetchedBoard) => {
        if (cancelled) return;
        setBoard(fetchedBoard);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getBoardErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [jobId, refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { board, isLoading, error, refetch };
}
