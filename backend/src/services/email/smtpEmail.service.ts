import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import type { EmailService, SendEmailInput } from "./email.types";

let cachedTransporter: Transporter | null = null;

// Fail-closed test-environment safeguard: a developer's local .env may
// legitimately hold real SMTP credentials (needed for manual/live
// verification), but `dotenv/config` loads that same .env unconditionally
// at import time regardless of NODE_ENV — so any test that forgets to
// `jest.mock(".../email.service")` would otherwise silently reach a real
// mail server using those real credentials (exactly what happened during
// this ticket, before individual test files were fixed one by one).
// Centralized here — the one place a real Transporter is ever
// constructed — rather than scattered as NODE_ENV checks across business
// services. Production/development are completely unaffected: this only
// ever fires when NODE_ENV is literally "test".
function assertNotRunningUnderTest(): void {
  if (env.NODE_ENV === "test") {
    throw new Error(
      "Refusing to create a real SMTP transporter while NODE_ENV=test. " +
        "This test must mock '../src/services/email/email.service' (see tests/interview.api.test.ts for the pattern) " +
        "instead of exercising the real SMTP transport."
    );
  }
}

function ensureConfigured(): Transporter {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM_ADDRESS) {
    throw new Error(
      "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM_ADDRESS in backend/.env."
    );
  }

  assertNotRunningUnderTest();

  if (!cachedTransporter) {
    cachedTransporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE ?? env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    });
  }

  return cachedTransporter;
}

export const smtpEmailService: EmailService = {
  async send({ to, subject, text, html }: SendEmailInput): Promise<void> {
    const transporter = ensureConfigured();

    await transporter.sendMail({
      from: `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`,
      to,
      subject,
      text,
      html,
    });
  },
};
