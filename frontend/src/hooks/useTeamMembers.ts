import { useCallback, useEffect, useState } from "react";
import * as teamApi from "@/services/api/team";
import { getTeamListErrorMessage } from "@/lib/teamErrors";
import type { TeamMember } from "@/types/team";

interface UseTeamMembersResult {
  members: TeamMember[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTeamMembers(): UseTeamMembersResult {
  const [members, setMembers] = useState<TeamMember[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    teamApi
      .listTeamMembers()
      .then(({ members: fetched }) => {
        if (cancelled) return;
        setMembers(fetched);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(getTeamListErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refetchCount]);

  const refetch = useCallback(() => setRefetchCount((c) => c + 1), []);

  return { members, isLoading, error, refetch };
}
