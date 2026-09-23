import type { CompanyInvitationDoc } from "../../models/CompanyInvitation.model";
import type { UserRole } from "../../models/User.model";
import { isInvitationExpired } from "../team/companyInvitationState";

// Matches this ticket's own Part 20 vocabulary exactly ("valid, expired,
// revoked, already accepted, invalid") — deliberately NOT the same words
// as the internal stored CompanyInvitationStatus ("pending"/"accepted"/
// "revoked"): "valid" here means "pending AND not expired", the live
// state a genuine invitee can still act on, same translation Offer's
// public "awaiting_response" state applies to its own stored "sent".
export const COMPANY_INVITATION_RESPONSE_STATES = ["valid", "accepted", "revoked", "expired", "invalid"] as const;
export type CompanyInvitationResponseState = (typeof COMPANY_INVITATION_RESPONSE_STATES)[number];

// Only ever the safe, candidate-... err, invitee-facing fields (Part 7):
// no company_id, no invited_by internal id, no other members, no tenant
// data. `role` is the raw value ("HR") — the frontend renders its display
// label, same convention as offerResponse's public DTO.
export interface CompanyInvitationResponseDTO {
  state: CompanyInvitationResponseState;
  company_name?: string;
  invited_email?: string;
  role?: UserRole;
  expires_at?: string;
}

export const INVALID_INVITATION_RESULT: CompanyInvitationResponseDTO = { state: "invalid" };

export function deriveInvitationResponseState(invitation: CompanyInvitationDoc): CompanyInvitationResponseState {
  if (invitation.status === "accepted") return "accepted";
  if (invitation.status === "revoked") return "revoked";
  return isInvitationExpired(invitation) ? "expired" : "valid";
}

export function serializeInvitationResponse(invitation: CompanyInvitationDoc, companyName: string): CompanyInvitationResponseDTO {
  return {
    state: deriveInvitationResponseState(invitation),
    company_name: companyName,
    invited_email: invitation.email,
    role: invitation.role,
    expires_at: invitation.expires_at.toISOString(),
  };
}
