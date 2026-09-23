import type { UserRole } from "@/types/auth";

export const COMPANY_INVITATION_RESPONSE_STATES = ["valid", "accepted", "revoked", "expired", "invalid"] as const;
export type CompanyInvitationResponseState = (typeof COMPANY_INVITATION_RESPONSE_STATES)[number];

export interface CompanyInvitationResponseResult {
  state: CompanyInvitationResponseState;
  company_name?: string;
  invited_email?: string;
  role?: UserRole;
  expires_at?: string;
}
