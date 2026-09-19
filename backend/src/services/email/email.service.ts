import { smtpEmailService } from "./smtpEmail.service";
import type { EmailService } from "./email.types";

// The single point application code depends on. Swapping providers later
// (e.g. a transactional email API instead of SMTP) means changing only
// this file's export, not application.service.ts or anything that already
// consumes the EmailService interface. Tests mock this entire module.
export const emailService: EmailService = smtpEmailService;

export type { EmailService, SendEmailInput } from "./email.types";
