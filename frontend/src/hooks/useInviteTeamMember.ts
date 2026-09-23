import { useCallback, useState } from "react";
import * as teamApi from "@/services/api/team";
import { getInviteTeamMemberErrorMessage } from "@/lib/teamErrors";
import type { TeamInvitation } from "@/types/team";

interface UseInviteTeamMemberResult {
  run: (email: string) => Promise<TeamInvitation | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useInviteTeamMember(): UseInviteTeamMemberResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (email: string): Promise<TeamInvitation | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { invitation } = await teamApi.inviteTeamMember(email);
        return invitation;
      } catch (err) {
        setError(getInviteTeamMemberErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, isSubmitting, error, clearError };
}
