import { useCallback, useState } from "react";
import * as teamApi from "@/services/api/team";
import { getInvitationActionErrorMessage } from "@/lib/teamErrors";
import type { TeamInvitation } from "@/types/team";

interface UseResendTeamInvitationResult {
  run: (invitationId: string) => Promise<TeamInvitation | null>;
  isSubmitting: boolean;
  error: string | null;
}

// Backs both the "Resend" (already-sent) and "Retry Email" (failed)
// buttons — both call the exact same endpoint (see
// companyInvitation.service.ts's resendTeamInvitation doc comment).
export function useResendTeamInvitation(): UseResendTeamInvitationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (invitationId: string): Promise<TeamInvitation | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { invitation } = await teamApi.resendTeamInvitation(invitationId);
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
