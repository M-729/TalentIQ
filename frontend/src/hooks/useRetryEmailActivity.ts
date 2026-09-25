import { useCallback, useState } from "react";
import { retryInterviewNotification } from "@/services/api/interviewNotifications";
import { retryAssessmentNotification } from "@/services/api/applicationAssessments";
import { retryOfferNotification } from "@/services/api/offers";
import { retryRejectionEmail } from "@/services/api/rejection";
import { resendTeamInvitation } from "@/services/api/team";
import { ApiError } from "@/services/api/client";
import type { EmailActivityRow } from "@/types/emailActivity";

interface UseRetryEmailActivityResult {
  run: (row: EmailActivityRow) => Promise<boolean>;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Dispatches to whichever EXISTING, category-specific retry/resend
 * endpoint actually owns this row's business rules — never a generic
 * retry route (see this ticket's explicit Part 7 "do not invent a
 * generic retry endpoint that bypasses category-specific business rules"
 * rule). Every branch reuses an API function that already existed before
 * this ticket.
 */
export function useRetryEmailActivity(): UseRetryEmailActivityResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (row: EmailActivityRow): Promise<boolean> => {
      if (isSubmitting) return false;
      setIsSubmitting(true);
      setError(null);
      try {
        switch (row.type) {
          case "interview_scheduled":
          case "interview_rescheduled":
          case "interview_cancelled":
            if (!row.public_id) throw new Error("Missing notification reference");
            await retryInterviewNotification(row.public_id);
            break;
          case "assessment_invitation":
            if (!row.related_assessment_public_id) throw new Error("Missing assessment reference");
            if (!row.public_id) throw new Error("Missing notification reference");
            await retryAssessmentNotification(row.related_assessment_public_id, row.public_id);
            break;
          case "offer_sent":
            if (!row.related_offer_public_id) throw new Error("Missing offer reference");
            if (!row.public_id) throw new Error("Missing notification reference");
            await retryOfferNotification(row.related_offer_public_id, row.public_id);
            break;
          case "application_rejection":
            if (!row.related_application_public_id) throw new Error("Missing application reference");
            await retryRejectionEmail(row.related_application_public_id);
            break;
          case "company_invitation":
            if (!row.related_invitation_public_id) throw new Error("Missing invitation reference");
            await resendTeamInvitation(row.related_invitation_public_id);
            break;
        }
        return true;
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "This email could not be retried. Try again.");
        return false;
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  return { run, isSubmitting, error };
}
