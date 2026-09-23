import { useCallback, useEffect, useState } from "react";
import * as teamApi from "@/services/api/team";
import { getTeamListErrorMessage } from "@/lib/teamErrors";
import type { TeamInvitation } from "@/types/team";

interface UseTeamInvitationsResult {
  invitations: TeamInvitation[] | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useTeamInvitations(): UseTeamInvitationsResult {
  const [invitations, setInvitations] = useState<TeamInvitation[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchCount, setRefetchCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    teamApi
      .listTeamInvitations()
      .then(({ invitations: fetched }) => {
        if (cancelled) return;
        setInvitations(fetched);
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

  return { invitations, isLoading, error, refetch };
}
