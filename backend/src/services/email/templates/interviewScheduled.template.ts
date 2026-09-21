import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";
import { renderInterviewEmailTextDetails, wrapInterviewEmailHtml, type InterviewEmailDetailRow } from "./interviewEmailLayout";

export interface InterviewScheduledEmailInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  interviewTitle: string;
  stageName: string;
  /** Pre-formatted via utils/timezone.ts's formatZonedDate — e.g. "Monday, September 21, 2026". */
  dateLabel: string;
  /** Pre-formatted via utils/timezone.ts's formatZonedTimeRange — e.g. "4:00 PM – 5:00 PM". */
  timeRangeLabel: string;
  timezone: string;
  interviewerNames: string[];
  /** null when no Google Calendar event/Meet link exists yet — the email must remain useful either way; never fabricated here. */
  meetingUrl: string | null;
}

function buildDetailRows(input: InterviewScheduledEmailInput): InterviewEmailDetailRow[] {
  const rows: InterviewEmailDetailRow[] = [
    { label: "Role", value: input.jobTitle },
    { label: "Interview", value: input.interviewTitle },
    { label: "Stage", value: input.stageName },
    { label: "Date", value: input.dateLabel },
    { label: "Time", value: input.timeRangeLabel },
    { label: "Timezone", value: input.timezone },
  ];
  if (input.interviewerNames.length > 0) {
    rows.push({ label: "Interviewers", value: input.interviewerNames.join(", ") });
  }
  return rows;
}

export function buildInterviewScheduledEmail(input: InterviewScheduledEmailInput): EmailContent {
  const subject = `Interview scheduled — ${input.jobTitle}`;
  const detailRows = buildDetailRows(input);

  // The interview may legitimately have no Meet link yet (Google Calendar
  // is optional and may not be connected/created at schedule time) — this
  // must never claim the interview is remote, and never invent a URL.
  const meetingNote = input.meetingUrl
    ? ""
    : "\n\nMeeting details will be shared separately if applicable.";

  const text = [
    `Hello ${input.candidateName},`,
    "",
    `Your interview for the ${input.jobTitle} position at ${input.companyName} has been scheduled.`,
    "",
    ...renderInterviewEmailTextDetails(detailRows),
    ...(input.meetingUrl ? ["", `Join Google Meet: ${input.meetingUrl}`] : []),
    meetingNote,
    "",
    "Best regards,",
    `${input.companyName} Hiring Team`,
    "Powered by TalentIQ",
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");

  const introHtml = `
                <p style="margin:0 0 16px;">Hello ${escapeHtml(input.candidateName)},</p>
                <p style="margin:0 0 16px;">Your interview for the <strong>${escapeHtml(input.jobTitle)}</strong> position at <strong>${escapeHtml(
    input.companyName
  )}</strong> has been scheduled.</p>`;

  const closingHtml = input.meetingUrl
    ? ""
    : `<p style="margin:16px 0 0;color:#667085;">Meeting details will be shared separately if applicable.</p>`;

  const html = wrapInterviewEmailHtml({
    companyName: input.companyName,
    introHtml,
    detailRows,
    meetingUrl: input.meetingUrl,
    closingHtml,
  });

  return { subject, text, html };
}
