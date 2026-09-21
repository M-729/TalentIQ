import { useCallback, useEffect, useState } from "react";
import * as usersApi from "@/services/api/users";
import { getInterviewerDirectoryErrorMessage } from "@/lib/interviewErrors";
import type { InterviewerCandidate } from "@/types/user";

interface UseInterviewerCandidatesResult {
  interviewers: InterviewerCandidate[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

// Backing the interviewer picker in the schedule/reschedule dialogs.
export function useInterviewerCandidates(): UseInterviewerCandidatesResult {
  const [interviewers, setInterviewers] = useState<InterviewerCandidate[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    setIsLoading(true);
    setError(null);

    usersApi
      .listInterviewerCandidates(controller.signal)
      .then(({ users }) => {
        if (cancelled) return;
        setInterviewers(users);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getInterviewerDirectoryErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { interviewers, isLoading, error, refetch };
}
