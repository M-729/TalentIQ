export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** The shape every email template builder returns — shared across templates/templates/*.template.ts (matches applicationConfirmation.template.ts's own local EmailContent shape). */
export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

/**
 * Email abstraction that application.service.ts depends on, instead of
 * any specific provider's SDK directly. Swapping providers later means
 * changing only email.service.ts's export, not the application flow or
 * anything that already consumes the EmailService interface.
 */
export interface EmailService {
  send(input: SendEmailInput): Promise<void>;
}
