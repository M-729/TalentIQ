import type { EmailNotificationDoc } from "../../models/EmailNotification.model";
import { emailService } from "./email.service";
import type { EmailContent } from "./email.types";
import { mapSmtpError } from "./emailFailureTaxonomy";

/** Only the safe, already-normalized failure code is ever logged — never the raw SMTP error (see emailFailureTaxonomy.ts's mapSmtpError doc comment). */
function logSafeDeliveryFailure(notification: EmailNotificationDoc): void {
  console.error("[emailNotification] delivery failed", {
    notificationId: notification.id,
    category: notification.category,
    failureCode: notification.failure_code,
  });
}

/**
 * Attempts delivery for an already-persisted (pending or previously-
 * failed) notification and updates its status in place. Shared by every
 * EmailNotification category — interviewNotification.service.ts (interview
 * scheduled/rescheduled/cancelled) and applicationAssessmentEmail.service.ts
 * (assessment_invitation) both call this same function for both their
 * initial send AND their retry, so the actual SMTP-attempt/status-update
 * mechanics can never drift between categories. Never throws: SMTP failure
 * is recorded on the document, not propagated, so a caller further up (an
 * Interview/Assessment mutation handler, or an explicit send/retry
 * endpoint) never fails because of it.
 */
export async function attemptEmailDelivery(notification: EmailNotificationDoc, content: EmailContent): Promise<void> {
  notification.attempted_at = new Date();
  notification.attempt_count += 1;
  // Deterministic given the (frozen) snapshot — re-setting this on every
  // attempt is a no-op in practice, not a source of drift.
  notification.subject = content.subject;

  try {
    await emailService.send({ to: notification.recipient_email, subject: content.subject, text: content.text, html: content.html });
    notification.status = "sent";
    notification.sent_at = new Date();
    notification.failure_code = null;
  } catch (err) {
    notification.status = "failed";
    notification.failure_code = mapSmtpError(err);
    logSafeDeliveryFailure(notification);
  }

  await notification.save();
}
