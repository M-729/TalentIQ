import { useCallback, useState } from "react";
import * as applicationAssessmentsApi from "@/services/api/applicationAssessments";
import { getRecordResultErrorMessage } from "@/lib/applicationAssessmentErrors";
import type { ApplicationAssessment, RecordAssessmentResultInput } from "@/types/applicationAssessment";

interface UseRecordAssessmentResultResult {
  run: (assessmentId: string, input: RecordAssessmentResultInput) => Promise<ApplicationAssessment | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Never triggers a pipeline movement or a candidate email — see this
// ticket's explicit Part 19/20/28. Result editing is a normal controlled
// update (not append-only) for this scope.
export function useRecordAssessmentResult(): UseRecordAssessmentResultResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (assessmentId: string, input: RecordAssessmentResultInput): Promise<ApplicationAssessment | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { assessment } = await applicationAssessmentsApi.recordAssessmentResult(assessmentId, input);
        return assessment;
      } catch (err) {
        setError(getRecordResultErrorMessage(err));
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
