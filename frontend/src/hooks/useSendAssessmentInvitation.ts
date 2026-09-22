import { useCallback, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getSendAssessmentErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { AssessmentNotification } from "@/types/applicationAssessment";

interface UseSendAssessmentInvitationResult {
  /** Used for both "Send Assessment" (first time) and "Send Again" (after a previous successful send) — both always create a brand-new communication event server-side. */
  run: (assessmentId: string) => Promise<AssessmentNotification | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

export function useSendAssessmentInvitation(): UseSendAssessmentInvitationResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (assessmentId: string): Promise<AssessmentNotification | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { notification } = await applicationAssessmentsApi.sendAssessmentInvitation(assessmentId);
        return notification;
      } catch (err) {
        setError(getSendAssessmentErrorMessage(err));
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
