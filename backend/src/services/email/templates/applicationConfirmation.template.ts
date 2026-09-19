export interface ApplicationConfirmationInput {
  candidateName: string;
  jobTitle: string;
  companyName: string;
}

export interface EmailContent {
  subject: string;
  text: string;
  html: string;
}

// Candidate name / job title / company name all originate from
// user-controlled or database input (a candidate types their own name; a
// company name is HR-entered). Never interpolate them into HTML
// unescaped — this is the only thing standing between a candidate typing
// "<script>..." as their name and it running in whatever renders this
// email as HTML.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildApplicationConfirmationEmail(input: ApplicationConfirmationInput): EmailContent {
  const { candidateName, jobTitle, companyName } = input;

  const subject = `Application received — ${jobTitle}`;

  // Plain-text fallback: no escaping needed/wanted here, this is rendered
  // as literal text, not parsed as markup.
  const text = [
    `Hello ${candidateName},`,
    "",
    `Thank you for applying for the ${jobTitle} position at ${companyName}.`,
    "",
    "Your application has been received successfully. The hiring team will review your application and contact you by email if there are further steps.",
    "",
    "Regards,",
    `${companyName} Recruiting Team`,
    "Powered by TalentIQ",
  ].join("\n");

  const safeCandidateName = escapeHtml(candidateName);
  const safeJobTitle = escapeHtml(jobTitle);
  const safeCompanyName = escapeHtml(companyName);

  // Deliberately simple, table-based, inline-styled markup — email clients
  // are notoriously inconsistent with modern CSS, and this ticket doesn't
  // call for a full HTML design system, just a professional, readable
  // notification.
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
                <p style="margin:0 0 16px;">Hello ${safeCandidateName},</p>
                <p style="margin:0 0 16px;">Thank you for applying for the <strong>${safeJobTitle}</strong> position at <strong>${safeCompanyName}</strong>.</p>
                <p style="margin:0 0 16px;">Your application has been received successfully. The hiring team will review your application and contact you by email if there are further steps.</p>
                <p style="margin:24px 0 0;color:#667085;font-size:13px;">
                  Regards,<br />
                  ${safeCompanyName} Recruiting Team<br />
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
