import {
  CompanyInvitation,
  companyInvitationIdentifierFilter,
  type CompanyInvitationDoc,
} from "../../models/CompanyInvitation.model";
import { User } from "../../models/User.model";
import { Company } from "../../models/Company.model";
import { ConflictError, NotFoundError } from "../../security/AppError";
import { assertOwnedByCompany, companyFilter } from "../../security/companyScope";
import { emailService } from "../../services/email/email.service";
import { mapSmtpError } from "../../services/email/emailFailureTaxonomy";
import { buildCompanyInvitationEmail } from "../../services/email/templates/companyInvitation.template";
import { env } from "../../config/env";
import { computeInvitationExpiry, generateInvitationToken, hashInvitationToken } from "./companyInvitationToken.service";

const NOT_FOUND_MESSAGE = "Invitation not found";
const ALREADY_MEMBER_MESSAGE = "This person is already a member of your team.";
const EMAIL_TAKEN_MESSAGE = "This email already belongs to an existing account.";
const ALREADY_PENDING_MESSAGE = "An invitation is already pending for this email.";
const NOT_REVOCABLE_MESSAGE = "This invitation can no longer be revoked.";
const NOT_RESENDABLE_MESSAGE = "This invitation can no longer be resent.";

/** "September 30, 2026" in UTC — same convention as offerEmail.service.ts's formatUtcDate, reused independently here since this module has no other dependency on offers. */
function formatUtcDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "long", day: "numeric" }).format(date);
}

/** The public accept-invitation page, with the token in a URL FRAGMENT (never a query/path segment) — same rationale as offerEmail.service.ts's buildOfferResponseUrl: a fragment is never sent to any web server as part of the initial page load. */
function buildAcceptInvitationUrl(token: string): string {
  return `${env.FRONTEND_URL}/accept-invitation#token=${encodeURIComponent(token)}`;
}

/**
 * Sends (or re-sends) the invitation email and records the outcome on the
 * invitation document in place — mirrors emailNotificationDelivery
 * .service.ts's attemptEmailDelivery exactly (same try/catch/mapSmtpError/
 * save shape), just typed to CompanyInvitationDoc instead of
 * EmailNotificationDoc, since this model intentionally isn't an
 * EmailNotification row (see CompanyInvitation.model.ts's own doc
 * comment). Never throws — SMTP failure is recorded on the document, not
 * propagated, so inviting/resending never fails the whole request because
 * of it (the invitation stays "pending"; only email_status becomes
 * "failed").
 */
async function attemptInvitationEmailDelivery(invitation: CompanyInvitationDoc, rawToken: string): Promise<void> {
  const [company, inviter] = await Promise.all([
    Company.findById(invitation.company_id).select("name"),
    User.findById(invitation.invited_by_user_id).select("name"),
  ]);
  const content = buildCompanyInvitationEmail({
    companyName: company?.name ?? "your company",
    inviterName: inviter?.name ?? "Your team",
    role: invitation.role,
    expiresAtLabel: formatUtcDate(invitation.expires_at),
    acceptUrl: buildAcceptInvitationUrl(rawToken),
  });

  invitation.email_attempted_at = new Date();
  invitation.email_attempt_count += 1;

  try {
    await emailService.send({ to: invitation.email, subject: content.subject, text: content.text, html: content.html });
    invitation.email_status = "sent";
    invitation.email_sent_at = new Date();
    invitation.email_failure_code = null;
  } catch (err) {
    invitation.email_status = "failed";
    invitation.email_failure_code = mapSmtpError(err);
    // Only the safe, already-normalized failure code is ever logged — never the raw SMTP error, same principle as emailNotificationDelivery.service.ts's logSafeDeliveryFailure.
    console.error("[companyInvitation] delivery failed", { invitationId: invitation.id, failureCode: invitation.email_failure_code });
  }

  await invitation.save();
}

/**
 * Admin invites exactly one HR teammate by email. Role is never accepted
 * from the client (see team.validation.ts's inviteTeamMemberSchema) — it
 * is always the sole INVITABLE_ROLES value, "HR", decided here.
 *
 * Rejects (Part 11/16): an email that already belongs to a User anywhere
 * (User.email is globally unique — see User.model.ts), and a second
 * pending invitation for the same company+email (also enforced at the DB
 * level by CompanyInvitation's own partial unique index, as defense in
 * depth against a race between two concurrent invite requests).
 */
export async function inviteTeamMember(companyId: string, invitedByUserId: string, email: string): Promise<CompanyInvitationDoc> {
  const normalizedEmail = email.trim().toLowerCase();

  const existingUser = await User.findOne({ email: normalizedEmail }).select("company_id");
  if (existingUser) {
    throw new ConflictError(String(existingUser.company_id) === companyId ? ALREADY_MEMBER_MESSAGE : EMAIL_TAKEN_MESSAGE);
  }

  const existingPending = await CompanyInvitation.findOne({ company_id: companyId, email: normalizedEmail, status: "pending" });
  if (existingPending) {
    throw new ConflictError(ALREADY_PENDING_MESSAGE);
  }

  const rawToken = generateInvitationToken();
  const invitation = await CompanyInvitation.create({
    company_id: companyId,
    email: normalizedEmail,
    role: "HR",
    status: "pending",
    invited_by_user_id: invitedByUserId,
    token_hash: hashInvitationToken(rawToken),
    expires_at: computeInvitationExpiry(),
  });

  await attemptInvitationEmailDelivery(invitation, rawToken);
  return invitation;
}

/**
 * Re-sends a still-pending invitation's email with a FRESH token —
 * deliberately invalidating whatever token was in any earlier email (see
 * CompanyInvitation.model.ts's own doc comment on why this differs from
 * OfferResponseToken's multi-valid-token design). Also refreshes
 * expires_at, so this is the same action whether the Admin clicks
 * "Resend" (email previously sent) or "Retry Email" (email previously
 * failed) — both just mean "issue a new usable link and try again."
 */
export async function resendTeamInvitation(companyId: string, invitationId: string): Promise<CompanyInvitationDoc> {
  await assertOwnedByCompany(CompanyInvitation, companyInvitationIdentifierFilter(invitationId), companyId, {
    notFoundMessage: NOT_FOUND_MESSAGE,
  });

  const invitation = await CompanyInvitation.findOne(companyInvitationIdentifierFilter(invitationId));
  if (!invitation) throw new NotFoundError(NOT_FOUND_MESSAGE);
  if (invitation.status !== "pending") throw new ConflictError(NOT_RESENDABLE_MESSAGE);

  const rawToken = generateInvitationToken();
  invitation.token_hash = hashInvitationToken(rawToken);
  invitation.expires_at = computeInvitationExpiry();

  await attemptInvitationEmailDelivery(invitation, rawToken);
  return invitation;
}

/**
 * Race-safe against a concurrent acceptance: the atomic
 * {status:"pending"} guard means only one of "Admin revokes" vs "invitee
 * accepts" can ever win, exactly mirroring Offer's applyOfferResponse
 * status guard. The loser gets a clear conflict, never a silently
 * inconsistent state.
 */
export async function revokeTeamInvitation(companyId: string, invitationId: string): Promise<CompanyInvitationDoc> {
  await assertOwnedByCompany(CompanyInvitation, companyInvitationIdentifierFilter(invitationId), companyId, {
    notFoundMessage: NOT_FOUND_MESSAGE,
  });

  const revoked = await CompanyInvitation.findOneAndUpdate(
    { ...companyInvitationIdentifierFilter(invitationId), company_id: companyId, status: "pending" },
    { $set: { status: "revoked", revoked_at: new Date() } },
    { new: true }
  );
  if (!revoked) throw new ConflictError(NOT_REVOCABLE_MESSAGE);
  return revoked;
}

export async function listCompanyInvitations(companyId: string): Promise<CompanyInvitationDoc[]> {
  return CompanyInvitation.find(companyFilter(companyId)).sort({ created_at: -1 });
}
