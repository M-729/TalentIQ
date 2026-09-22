import { useCallback, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getAssessmentErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { ApplicationAssessment, UpdateAssessmentLinkInput } from "@/types/applicationAssessment";

interface UseUpdateApplicationAssessmentLinkResult {
  run: (assessmentId: string, input: UpdateAssessmentLinkInput) => Promise<ApplicationAssessment | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// name/external_url only — never re-sends the invitation email on its own
// (see this ticket's explicit Part 7).
export function useUpdateApplicationAssessmentLink(): UseUpdateApplicationAssessmentLinkResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (assessmentId: string, input: UpdateAssessmentLinkInput): Promise<ApplicationAssessment | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { assessment } = await applicationAssessmentsApi.updateAssessmentLink(assessmentId, input);
        return assessment;
      } catch (err) {
        setError(getAssessmentErrorMessage(err));
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
