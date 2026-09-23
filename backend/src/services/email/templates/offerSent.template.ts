import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";

export interface OfferSentEmailInput {
  candidateName: string;
  companyName: string;
  jobTitle: string;
  offerTitle: string;
  /** Already formatted (e.g. "$95,000 USD") — never raw amount/currency, and null when no salary was set. */
  salaryLabel: string | null;
  /** Already formatted (e.g. "September 23, 2026") — null when no start date was set. */
  startDateLabel: string | null;
  /** Already formatted — null when no expiration was set. */
  expiresAtLabel: string | null;
  /** HR's candidate-facing message — never internal_notes (see Offer.model.ts's own doc comment). Null when HR left it blank. */
  candidateMessage: string | null;
  /** The public candidate response page, with a fresh, never-persisted-in-plaintext response token embedded — see offerResponseToken.service.ts. Opening this link/GET must cause ZERO mutation; only the page's own explicit "Confirm acceptance" POST does. */
  acceptUrl: string;
  /** Same page as acceptUrl, pre-selecting the decline intent. */
  declineUrl: string;
}

/**
 * The ONLY candidate-facing content for an offer — deliberately excludes
 * internal_notes, AI score, interview feedback, assessment notes, and any
 * internal decision rationale (see this ticket's explicit Part 9 "do not
 * include" rule). Mirrors buildAssessmentInvitationEmail's simple,
 * table-based, inline-styled structure — no PDF, no e-signature, no
 * contract builder, just a professional summary of the terms.
 *
 * The two response links are deliberately just plain, inert URLs — opening
 * either one (a GET/page load, including an email security scanner or bot
 * automatically following the link) causes NO mutation whatsoever; the
 * candidate's browser lands on a public confirmation page that requires
 * one more explicit action ("Confirm acceptance"/"Confirm decline") before
 * anything is recorded. See offerResponse.routes.ts / the public
 * OfferResponsePage for where that actual mutation happens. Never uses the
 * word "Reject" for the candidate-facing action (see this ticket's
 * explicit Part 10 rule) — that word is reserved for HR's own "Reject
 * Candidate" action elsewhere in the product.
 */
export function buildOfferSentEmail(input: OfferSentEmailInput): EmailContent {
  const subject = `Job Offer – ${input.jobTitle} at ${input.companyName}`;

  const detailLines: string[] = [`Position: ${input.offerTitle}`];
  if (input.salaryLabel) detailLines.push(`Compensation: ${input.salaryLabel}`);
  if (input.startDateLabel) detailLines.push(`Start Date: ${input.startDateLabel}`);
  if (input.expiresAtLabel) detailLines.push(`This offer expires on: ${input.expiresAtLabel}`);

  const text = [
    `Hi ${input.candidateName},`,
    "",
    `Congratulations! We are pleased to offer you the ${input.jobTitle} position at ${input.companyName}.`,
    "",
    ...detailLines,
    "",
    ...(input.candidateMessage ? [input.candidateMessage, ""] : []),
    `Accept Offer: ${input.acceptUrl}`,
    `Decline Offer: ${input.declineUrl}`,
    "",
    "You can review and confirm your response securely through TalentIQ. Opening these links will not submit your response by itself — you'll be asked to confirm on the page.",
    "",
    "Best regards,",
    `${input.companyName} Hiring Team`,
    "Powered by TalentIQ",
  ].join("\n");

  const safeCandidateName = escapeHtml(input.candidateName);
  const safeCompanyName = escapeHtml(input.companyName);
  const safeJobTitle = escapeHtml(input.jobTitle);
  const safeOfferTitle = escapeHtml(input.offerTitle);
  // Callers only ever pass an already-constructed TalentIQ response URL
  // (see offerEmail.service.ts) — escaped here anyway as defense in depth
  // against the value being interpolated into an href attribute.
  const safeAcceptUrl = escapeHtml(input.acceptUrl);
  const safeDeclineUrl = escapeHtml(input.declineUrl);

  const detailRowsHtml = [
    `<tr><td style="padding:4px 0;color:#667085;">Position</td><td style="padding:4px 0;font-weight:bold;">${safeOfferTitle}</td></tr>`,
    input.salaryLabel
      ? `<tr><td style="padding:4px 0;color:#667085;">Compensation</td><td style="padding:4px 0;font-weight:bold;">${escapeHtml(input.salaryLabel)}</td></tr>`
      : "",
    input.startDateLabel
      ? `<tr><td style="padding:4px 0;color:#667085;">Start Date</td><td style="padding:4px 0;font-weight:bold;">${escapeHtml(input.startDateLabel)}</td></tr>`
      : "",
    input.expiresAtLabel
      ? `<tr><td style="padding:4px 0;color:#667085;">Offer Expires</td><td style="padding:4px 0;font-weight:bold;">${escapeHtml(input.expiresAtLabel)}</td></tr>`
      : "",
  ].join("");

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
                <p style="margin:0 0 16px;">Congratulations! We are pleased to offer you the <strong>${safeJobTitle}</strong> position at <strong>${safeCompanyName}</strong>.</p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;font-size:14px;width:100%;">
                  ${detailRowsHtml}
                </table>
                ${input.candidateMessage ? `<p style="margin:0 0 16px;">${escapeHtml(input.candidateMessage)}</p>` : ""}
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
                  <tr>
                    <td style="padding-right:8px;">
                      <a href="${safeAcceptUrl}" style="display:inline-block;background-color:#16A34A;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold;">Accept Offer</a>
                    </td>
                    <td>
                      <a href="${safeDeclineUrl}" style="display:inline-block;background-color:#FFFFFF;color:#DC2626;border:1px solid #DC2626;text-decoration:none;padding:9px 19px;border-radius:6px;font-size:14px;font-weight:bold;">Decline Offer</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;color:#667085;font-size:13px;">You can review and confirm your response securely through TalentIQ. Opening these links will not submit your response by itself — you'll be asked to confirm on the page.</p>
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
