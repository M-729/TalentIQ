import { apiClient } from "@/services/api/client";
import type { AuthUser } from "@/types/auth";
import type { CompanyInvitationResponseResult } from "@/types/companyInvitation";

export function lookupCompanyInvitation(token: string): Promise<CompanyInvitationResponseResult> {
  return apiClient.post<CompanyInvitationResponseResult>("/public/company-invitations/lookup", { token });
}

// On state:"accepted" the response also carries accessToken/user (the
// same auto-login shape login()/companySignup() return); every other
// state carries neither — see companyInvitationResponse.controller.ts.
export interface AcceptCompanyInvitationResponse extends CompanyInvitationResponseResult {
  accessToken?: string;
  user?: AuthUser;
}

export function acceptCompanyInvitation(token: string, fullName: string, password: string): Promise<AcceptCompanyInvitationResponse> {
  return apiClient.post<AcceptCompanyInvitationResponse>("/public/company-invitations/accept", {
    token,
    full_name: fullName,
    password,
  });
}
