import { useCallback, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getAssessmentErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { ApplicationAssessment, CreateAssessmentInput } from "@/types/applicationAssessment";

interface UseCreateApplicationAssessmentResult {
  run: (applicationId: string, input: CreateAssessmentInput) => Promise<ApplicationAssessment | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Never sends an email — the backend only ever persists the record here
// (see useSendAssessmentInvitation for the separate, explicit send action).
export function useCreateApplicationAssessment(): UseCreateApplicationAssessmentResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (applicationId: string, input: CreateAssessmentInput): Promise<ApplicationAssessment | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { assessment } = await applicationAssessmentsApi.createAssessment(applicationId, input);
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
