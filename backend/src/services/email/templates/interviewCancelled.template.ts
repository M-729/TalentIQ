import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";
import { renderInterviewEmailTextDetails, wrapInterviewEmailHtml, type InterviewEmailDetailRow } from "./interviewEmailLayout";

export interface InterviewCancelledEmailInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  interviewTitle: string;
  /** The originally scheduled date/time — pre-formatted via utils/timezone.ts. */
  dateLabel: string;
  timeRangeLabel: string;
  timezone: string;
  // Deliberately NO cancellation reason field — the internal HR-entered
  // cancellation_reason must never appear in the candidate-facing email
  // (see this ticket's explicit privacy rule). If a future ticket adds a
  // separate, explicitly candidate-facing cancellation message field,
  // that field — never cancellation_reason — would be added here.
}

export function buildInterviewCancelledEmail(input: InterviewCancelledEmailInput): EmailContent {
  const subject = `Interview cancelled — ${input.jobTitle}`;

  const detailRows: InterviewEmailDetailRow[] = [
    { label: "Role", value: input.jobTitle },
    { label: "Interview", value: input.interviewTitle },
    { label: "Was scheduled for", value: `${input.dateLabel}, ${input.timeRangeLabel} (${input.timezone})` },
  ];

  const text = [
    `Hello ${input.candidateName},`,
    "",
    `Your interview for the ${input.jobTitle} position at ${input.companyName} has been CANCELLED.`,
    "",
    ...renderInterviewEmailTextDetails(detailRows),
    "",
    "If you have any questions, please reach out to the hiring team.",
    "",
    "Best regards,",
    `${input.companyName} Hiring Team`,
    "Powered by TalentIQ",
  ].join("\n");

  const introHtml = `
                <p style="margin:0 0 16px;">Hello ${escapeHtml(input.candidateName)},</p>
                <p style="margin:0 0 16px;">Your interview for the <strong>${escapeHtml(input.jobTitle)}</strong> position at <strong>${escapeHtml(
    input.companyName
  )}</strong> has been <strong>cancelled</strong>.</p>`;

  const closingHtml = `<p style="margin:16px 0 0;">If you have any questions, please reach out to the hiring team.</p>`;

  const html = wrapInterviewEmailHtml({
    companyName: input.companyName,
    introHtml,
    detailRows,
    meetingUrl: null,
    closingHtml,
  });

  return { subject, text, html };
}
