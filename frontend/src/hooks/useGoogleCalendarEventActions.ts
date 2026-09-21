import { useCallback, useState } from "react";
import * as interviewsApi from "@/services/api/interviews";
import { getCalendarActionErrorMessage } from "@/lib/interviewErrors";
import type { Interview } from "@/types/interview";

interface UseGoogleCalendarEventActionsResult {
  /** Explicit "Add to Google Calendar" — never called automatically. */
  createEvent: (interviewId: string) => Promise<Interview | null>;
  /** The one retry/reconciliation action ("Sync Calendar"). */
  syncEvent: (interviewId: string) => Promise<Interview | null>;
  isSubmitting: boolean;
  error: string | null;
  clearError: () => void;
}

// Both actions are explicit, user-initiated requests (unlike reschedule/
// cancel's best-effort background sync) — a failure here IS the
// request's failure and is surfaced as a real error, since the whole
// point of calling either is "tell me whether this worked".
export function useGoogleCalendarEventActions(): UseGoogleCalendarEventActionsResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCallback(
    async (interviewId: string): Promise<Interview | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { interview } = await interviewsApi.createGoogleCalendarEvent(interviewId);
        return interview;
      } catch (err) {
        setError(getCalendarActionErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  const syncEvent = useCallback(
    async (interviewId: string): Promise<Interview | null> => {
      if (isSubmitting) return null;
      setIsSubmitting(true);
      setError(null);
      try {
        const { interview } = await interviewsApi.syncGoogleCalendarEvent(interviewId);
        return interview;
      } catch (err) {
        setError(getCalendarActionErrorMessage(err));
        return null;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  const clearError = useCallback(() => setError(null), []);

  return { createEvent, syncEvent, isSubmitting, error, clearError };
}
