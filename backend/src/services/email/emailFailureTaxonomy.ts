import { EMAIL_FAILURE_CODES, type EmailFailureCode } from "../../models/EmailNotification.model";

export { EMAIL_FAILURE_CODES };
export type { EmailFailureCode };

/**
 * Translates whatever the SMTP transport (Nodemailer) throws into a safe,
 * provider-neutral EmailFailureCode — this is the ONLY place a raw
 * SMTP/Nodemailer error's shape is inspected. No caller ever sees the
 * original error, its message, or its stack; only this safe code is ever
 * persisted (EmailNotification.failure_code) or logged, matching the same
 * "no raw provider errors" principle already established for Google
 * Calendar (see googleCalendar.service.ts's mapGoogleApiError).
 *
 * Nodemailer/SMTP errors typically carry a `code` (e.g. "EAUTH" for an
 * auth failure, "ECONNECTION"/"ETIMEDOUT"/"ESOCKET"/"EDNS" for a
 * transport-level failure to even reach the server) and/or a
 * `responseCode` (the numeric SMTP reply code, e.g. 535 for bad
 * credentials, 550/551/553 for a rejected recipient, 421 for a
 * temporarily unavailable service).
 */
export function mapSmtpError(err: unknown): EmailFailureCode {
  if (err instanceof Error && err.message.startsWith("SMTP email is not configured")) {
    return "smtp_not_configured";
  }

  if (typeof err !== "object" || err === null) {
    return "delivery_failed";
  }

  const shaped = err as { code?: unknown; responseCode?: unknown };
  const code = typeof shaped.code === "string" ? shaped.code : undefined;
  const responseCode = typeof shaped.responseCode === "number" ? shaped.responseCode : undefined;

  if (code === "EAUTH" || responseCode === 535) {
    return "authentication_failed";
  }

  if (responseCode !== undefined && [550, 551, 553].includes(responseCode)) {
    return "recipient_rejected";
  }

  if (code && ["ECONNECTION", "ETIMEDOUT", "ESOCKET", "EDNS"].includes(code)) {
    return "smtp_unavailable";
  }
  if (responseCode === 421) {
    return "smtp_unavailable";
  }

  return "delivery_failed";
}
