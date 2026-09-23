import type { CompanyInvitationDoc } from "../../models/CompanyInvitation.model";

/**
 * The single shared definition of "is this invitation past its expiry" —
 * used by both the Admin-facing team serializer (to show "Expired" instead
 * of "Pending" in the Pending Invitations table) and the public
 * lookup/accept flow (to derive the "expired" state — see
 * CompanyInvitation.model.ts's own doc comment on why expiry is derived
 * from expires_at rather than stored as its own status value). Only
 * meaningful for a still-"pending" invitation; an accepted/revoked one is
 * never "expired", it's just accepted/revoked.
 */
export function isInvitationExpired(invitation: Pick<CompanyInvitationDoc, "status" | "expires_at">): boolean {
  return invitation.status === "pending" && invitation.expires_at.getTime() < Date.now();
}
