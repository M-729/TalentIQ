import type { UserRole, UserStatus } from "@/types/auth";

export interface TeamMember {
  id: string;
  // Opaque, URL-safe identifier — TeamSettingsPage passes this (via
  // resourceUrlId) to every deactivate/reactivate/revoke/resend action
  // call; the backend is public-id only (Phase 2 cutover), no dual-accept.
  public_id?: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  created_at: string;
}

export type InvitationStatus = "pending" | "accepted" | "revoked";
export type InvitationEmailStatus = "pending" | "sent" | "failed";

export interface TeamInvitation {
  id: string;
  // Opaque, URL-safe identifier — see TeamMember.public_id.
  public_id?: string;
  email: string;
  role: UserRole;
  status: InvitationStatus;
  is_expired: boolean;
  expires_at: string;
  invited_by: { id: string; name: string } | null;
  created_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  email_status: InvitationEmailStatus;
  email_failure_code: string | null;
}
