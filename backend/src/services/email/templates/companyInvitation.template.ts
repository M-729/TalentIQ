import type { EmailContent } from "../email.types";
import { escapeHtml } from "./escapeHtml";

const ROLE_LABELS: Record<string, string> = {
  HR: "HR / Recruiter",
  ADMIN: "Admin",
};

export interface CompanyInvitationEmailInput {
  companyName: string;
  inviterName: string;
  /** Raw role value ("HR") — translated to its display label here, never shown raw. */
  role: string;
  /** Already formatted (e.g. "September 30, 2026") — this ticket's Part 9 "This invitation expires on ..." line. */
  expiresAtLabel: string;
  /** The public accept-invitation page, with a fresh, never-persisted-in-plaintext token embedded in the URL fragment — see companyInvitationToken.service.ts. Opening this link/GET must cause ZERO mutation; only the page's own explicit "Join company" POST does. */
  acceptUrl: string;
}

/**
 * The ONLY content of a Team Member invitation email — no internal ids,
 * no other members' data, nothing about the inviting company beyond its
 * name. Mirrors buildOfferSentEmail's simple, table-based, inline-styled
 * structure and its exact scanner-safety framing: the link is a plain,
 * inert URL that a GET (including an email security scanner) cannot use
 * to join anything — only the invitee's own explicit "Join company" click
 * on the public accept-invitation page can.
 */
export function buildCompanyInvitationEmail(input: CompanyInvitationEmailInput): EmailContent {
  const roleLabel = ROLE_LABELS[input.role] ?? input.role;
  const subject = `You've been invited to join ${input.companyName} on TalentIQ`;

  const text = [
    "You've been invited to TalentIQ",
    "",
    `Hi,`,
    "",
    `${input.inviterName} invited you to join:`,
    "",
    input.companyName,
    "",
    "as:",
    "",
    roleLabel,
    "",
    `Accept Invitation: ${input.acceptUrl}`,
    "",
    `This invitation expires on ${input.expiresAtLabel}.`,
    "",
    "Opening this link does not itself create your account — you'll be asked to set a password and confirm before joining.",
    "",
    "Powered by TalentIQ",
  ].join("\n");

  const safeCompanyName = escapeHtml(input.companyName);
  const safeInviterName = escapeHtml(input.inviterName);
  const safeRoleLabel = escapeHtml(roleLabel);
  const safeExpiresAtLabel = escapeHtml(input.expiresAtLabel);
  // Callers only ever pass an already-constructed TalentIQ accept-invitation
  // URL (see companyInvitation.service.ts) — escaped here anyway as
  // defense in depth against the value being interpolated into an href.
  const safeAcceptUrl = escapeHtml(input.acceptUrl);

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
                <p style="margin:0 0 16px;font-weight:bold;font-size:17px;">You've been invited to TalentIQ</p>
                <p style="margin:0 0 16px;">Hi,</p>
                <p style="margin:0 0 16px;"><strong>${safeInviterName}</strong> invited you to join:</p>
                <p style="margin:0 0 16px;font-size:18px;font-weight:bold;">${safeCompanyName}</p>
                <p style="margin:0 0 20px;">as: <strong>${safeRoleLabel}</strong></p>
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">
                  <tr>
                    <td>
                      <a href="${safeAcceptUrl}" style="display:inline-block;background-color:#5546E8;color:#FFFFFF;text-decoration:none;padding:10px 20px;border-radius:6px;font-size:14px;font-weight:bold;">Accept Invitation</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px;color:#667085;font-size:13px;">This invitation expires on ${safeExpiresAtLabel}.</p>
                <p style="margin:0 0 16px;color:#667085;font-size:13px;">Opening this link does not itself create your account — you'll be asked to set a password and confirm before joining.</p>
                <p style="margin:24px 0 0;color:#667085;font-size:13px;">Powered by TalentIQ</p>
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
