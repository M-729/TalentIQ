import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";

export interface ApplicationRejectionEmailInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
}

/**
 * The ONLY candidate-facing content for a rejection notice — deliberately
 * generic and professional, with NO internal rejection_reason, AI score,
 * assessment grade, interviewer feedback, or internal notes anywhere in
 * it (see this ticket's explicit Part 2/4 "never expose internal reason to
 * candidate email" rule). Mirrors buildAssessmentInvitationEmail's simple,
 * table-based, inline-styled structure.
 */
export function buildApplicationRejectionEmail(input: ApplicationRejectionEmailInput): EmailContent {
  const subject = `Update on your application – ${input.jobTitle}`;

  const text = [
    `Hi ${input.candidateName},`,
    "",
    `Thank you for your interest in the ${input.jobTitle} position at ${input.companyName}, and for the time you invested in the process.`,
    "",
    "After careful consideration, we have decided not to move forward with your application at this time.",
    "",
    "We appreciate your interest in our company and wish you the best in your job search.",
    "",
    "Best regards,",
    `${input.companyName} Hiring Team`,
    "Powered by TalentIQ",
  ].join("\n");

  const safeCandidateName = escapeHtml(input.candidateName);
  const safeCompanyName = escapeHtml(input.companyName);
  const safeJobTitle = escapeHtml(input.jobTitle);

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#F7F8FC;font-family:Arial,Helvetica,sans-serif;color:#15172B;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F8FC;padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF;border-radius:8px;padding:32px;">
            <tr>
              <td style="font-size:20px;font-weight:bold;color:#5546E8;padding-bottom:16px;">TalentIQ</td>
            </tr>
            <tr>
              <td style="font-size:15px;line-height:1.6;">
                <p style="margin:0 0 16px;">Hi ${safeCandidateName},</p>
                <p style="margin:0 0 16px;">Thank you for your interest in the <strong>${safeJobTitle}</strong> position at <strong>${safeCompanyName}</strong>, and for the time you invested in the process.</p>
                <p style="margin:0 0 16px;">After careful consideration, we have decided not to move forward with your application at this time.</p>
                <p style="margin:0 0 16px;">We appreciate your interest in our company and wish you the best in your job search.</p>
                <p style="margin:24px 0 0;color:#667085;font-size:13px;">
                  Best regards,<br />
                  ${safeCompanyName} Hiring Team<br />
                  Powered by TalentIQ
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
