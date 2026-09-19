import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../../config/env";
import type { EmailService, SendEmailInput } from "./email.types";

let cachedTransporter: Transporter | null = null;

function ensureConfigured(): Transporter {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS || !env.EMAIL_FROM_ADDRESS) {
    throw new Error(
      "SMTP email is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and EMAIL_FROM_ADDRESS in backend/.env."
    );
  }

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
