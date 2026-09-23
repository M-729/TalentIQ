import type { UserDoc, UserRole, UserStatus } from "../../models/User.model";
import type { CompanyInvitationDoc, CompanyInvitationStatus } from "../../models/CompanyInvitation.model";
import type { EmailFailureCode } from "../../services/email/emailFailureTaxonomy";
import { User } from "../../models/User.model";
import { isInvitationExpired } from "./companyInvitationState";

export interface MemberDTO {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export function serializeMember(user: UserDoc): MemberDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    created_at: user.created_at!.toISOString(),
  };
}

export interface InvitationDTO {
  id: string;
  email: string;
  role: UserRole;
  // The raw stored lifecycle value — "pending" even once expired (see
  // CompanyInvitation.model.ts's own doc comment). Combine with
  // is_expired below to render "Expired" instead of "Pending".
  status: CompanyInvitationStatus;
  is_expired: boolean;
  expires_at: string;
  invited_by: { id: string; name: string } | null;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  email_status: "pending" | "sent" | "failed";
  email_failure_code: EmailFailureCode | null;
}

/**
 * Resolves inviter names in one batch query rather than N+1 lookups — same
 * pattern as offer.controller.ts's serializeOfferWithResponder, just for a
 * whole list at once instead of one document.
 */
export async function serializeInvitations(invitations: CompanyInvitationDoc[]): Promise<InvitationDTO[]> {
  const inviterIds = [...new Set(invitations.map((invitation) => String(invitation.invited_by_user_id)))];
  const inviters = await User.find({ _id: { $in: inviterIds } }).select("name");
  const inviterNameById = new Map(inviters.map((inviter) => [inviter.id, inviter.name]));

  return invitations.map((invitation) => {
    const inviterId = String(invitation.invited_by_user_id);
    const inviterName = inviterNameById.get(inviterId);
    return {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      is_expired: isInvitationExpired(invitation),
      expires_at: invitation.expires_at.toISOString(),
      invited_by: inviterName ? { id: inviterId, name: inviterName } : null,
      created_at: invitation.created_at!.toISOString(),
      accepted_at: invitation.accepted_at ? invitation.accepted_at.toISOString() : null,
      revoked_at: invitation.revoked_at ? invitation.revoked_at.toISOString() : null,
      email_status: invitation.email_status,
      email_failure_code: invitation.email_failure_code ?? null,
    };
  });
}
