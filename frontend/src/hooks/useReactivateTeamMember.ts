import { useCallback, useState } from "react";
import * as teamApi from "@/services/api/team";
import { getMemberActionErrorMessage } from "@/lib/teamErrors";
import type { TeamMember } from "@/types/team";

interface UseReactivateTeamMemberResult {
  run: (userId: string) => Promise<TeamMember | null>;
  isSubmitting: boolean;
  error: string | null;
}

export function useReactivateTeamMember(): UseReactivateTeamMemberResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (userId: string): Promise<TeamMember | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { member } = await teamApi.reactivateTeamMember(userId);
        return member;
      } catch (err) {
        setError(getMemberActionErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  return { run, isSubmitting, error };
}
