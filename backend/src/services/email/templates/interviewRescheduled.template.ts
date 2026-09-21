import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";
import { renderInterviewEmailTextDetails, wrapInterviewEmailHtml, type InterviewEmailDetailRow } from "./interviewEmailLayout";

export interface InterviewRescheduledEmailInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  interviewTitle: string;
  stageName: string;
  /** The NEW date/time — pre-formatted via utils/timezone.ts. */
  dateLabel: string;
  timeRangeLabel: string;
  timezone: string;
  interviewerNames: string[];
  meetingUrl: string | null;
}

function buildDetailRows(input: InterviewRescheduledEmailInput): InterviewEmailDetailRow[] {
  const rows: InterviewEmailDetailRow[] = [
    { label: "Role", value: input.jobTitle },
    { label: "Interview", value: input.interviewTitle },
    { label: "Stage", value: input.stageName },
    { label: "New date", value: input.dateLabel },
    { label: "New time", value: input.timeRangeLabel },
    { label: "Timezone", value: input.timezone },
  ];
  if (input.interviewerNames.length > 0) {
    rows.push({ label: "Interviewers", value: input.interviewerNames.join(", ") });
  }
  return rows;
}

// Deliberately unambiguous wording — the ticket requires it to be very
// clear the schedule changed, not a routine reminder.
export function buildInterviewRescheduledEmail(input: InterviewRescheduledEmailInput): EmailContent {
  const subject = `Interview rescheduled — ${input.jobTitle}`;
  const detailRows = buildDetailRows(input);

  const meetingNote = input.meetingUrl ? "" : "\n\nMeeting details will be shared separately if applicable.";

  const text = [
    `Hello ${input.candidateName},`,
    "",
    `Your interview for the ${input.jobTitle} position at ${input.companyName} has been RESCHEDULED. Please note the new date and time below.`,
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
  )}</strong> has been <strong>rescheduled</strong>. Please note the new date and time below.</p>`;

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
