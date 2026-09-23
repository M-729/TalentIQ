import { useCallback, useState } from "react";
import * as teamApi from "@/services/api/team";
import { getInvitationActionErrorMessage } from "@/lib/teamErrors";
import type { TeamInvitation } from "@/types/team";

interface UseRevokeTeamInvitationResult {
  run: (invitationId: string) => Promise<TeamInvitation | null>;
  isSubmitting: boolean;
  error: string | null;
}

export function useRevokeTeamInvitation(): UseRevokeTeamInvitationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (invitationId: string): Promise<TeamInvitation | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { invitation } = await teamApi.revokeTeamInvitation(invitationId);
        return invitation;
      } catch (err) {
        setError(getInvitationActionErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  return { run, isSubmitting, error };
}
