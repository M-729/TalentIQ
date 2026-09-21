import { escapeHtml } from "./escapeHtml";

export interface InterviewEmailDetailRow {
  label: string;
  /** Already the final display string (e.g. from utils/timezone.ts) — escaped here, not by the caller. */
  value: string;
}

/**
 * Shared shell for the three interview email templates (scheduled/
 * rescheduled/cancelled) — same simple, table-based, inline-styled,
 * email-client-safe structure as applicationConfirmation.template.ts,
 * factored out once since three templates now need it. Never a large
 * frontend-style Tailwind template, per this ticket's explicit
 * instruction.
 */
export function wrapInterviewEmailHtml(params: {
  companyName: string;
  introHtml: string;
  detailRows: InterviewEmailDetailRow[];
  /** Rendered only when a REAL backend meeting_url exists — callers never fabricate one. */
  meetingUrl?: string | null;
  closingHtml: string;
}): string {
  const safeCompanyName = escapeHtml(params.companyName);

  const detailRowsHtml = params.detailRows
    .map(
      (row) => `
            <tr>
              <td style="padding:4px 0;font-size:13px;color:#667085;width:120px;vertical-align:top;">${escapeHtml(row.label)}</td>
              <td style="padding:4px 0;font-size:14px;color:#15172B;">${escapeHtml(row.value)}</td>
            </tr>`
    )
    .join("");

  const meetButtonHtml = params.meetingUrl
    ? `
            <tr>
              <td style="padding-top:20px;">
                <a href="${escapeHtml(params.meetingUrl)}" style="display:inline-block;background-color:#5546E8;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold;">Join Google Meet</a>
              </td>
            </tr>`
    : "";

  return `<!doctype html>
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
                ${params.introHtml}
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid #E4E7EC;border-bottom:1px solid #E4E7EC;padding:12px 0;">
                  ${detailRowsHtml}
                </table>
                <table role="presentation" cellpadding="0" cellspacing="0">${meetButtonHtml}</table>
                ${params.closingHtml}
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
}

/** Plain-text equivalent of the shared detail rows — no HTML escaping needed, this is literal text. */
export function renderInterviewEmailTextDetails(detailRows: InterviewEmailDetailRow[]): string[] {
  return detailRows.map((row) => `${row.label}: ${row.value}`);
}
