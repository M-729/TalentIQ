import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";

export interface AssessmentInvitationEmailInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  assessmentName: string;
  /** Always the trusted, persisted external_url — http(s) only, validated well before this template ever runs. Never constructed here. */
  externalUrl: string;
}

/**
 * The ONLY candidate-facing content for an external assessment invitation
 * — deliberately excludes result/grade/notes (those are internal HR
 * workflow data, never emailed to the candidate; see this ticket's
 * explicit Part 10/20) and never claims TalentIQ hosts the exam. Mirrors
 * applicationConfirmation.template.ts's simple, table-based, inline-styled
 * structure (not interviewEmailLayout.ts's detail-row table, which is
 * interview-specific) — a single CTA button is all this needs.
 */
export function buildAssessmentInvitationEmail(input: AssessmentInvitationEmailInput): EmailContent {
  const subject = `Assessment Invitation – ${input.jobTitle}`;

  const text = [
    `Hi ${input.candidateName},`,
    "",
    `You've been invited to complete the ${input.assessmentName} for the ${input.jobTitle} position at ${input.companyName}.`,
    "",
    `Start Assessment: ${input.externalUrl}`,
    "",
    "The assessment is hosted on an external platform. Please follow the instructions on that platform.",
    "",
    "Best regards,",
    `${input.companyName} Hiring Team`,
    "Powered by TalentIQ",
  ].join("\n");

  const safeCandidateName = escapeHtml(input.candidateName);
  const safeCompanyName = escapeHtml(input.companyName);
  const safeJobTitle = escapeHtml(input.jobTitle);
  const safeAssessmentName = escapeHtml(input.assessmentName);
  // Callers only ever pass an already-validated http(s) URL (see
  // applicationAssessment.validation.ts) — escaped here anyway as defense
  // in depth against the value being interpolated into an href attribute.
  const safeExternalUrl = escapeHtml(input.externalUrl);

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
                <p style="margin:0 0 16px;">You've been invited to complete the <strong>${safeAssessmentName}</strong> for the <strong>${safeJobTitle}</strong> position at <strong>${safeCompanyName}</strong>.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
                  <tr>
                    <td>
                      <a href="${safeExternalUrl}" style="display:inline-block;background-color:#5546E8;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold;">Start Assessment</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;color:#667085;font-size:13px;">The assessment is hosted on an external platform. Please follow the instructions on that platform.</p>
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
