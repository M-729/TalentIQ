import type { UserRole, UserStatus } from "@/types/auth";

export interface TeamMember {
  id: string;
  // Opaque, URL-safe identifier — kept in sync with every other migrated
  // resource; Team Settings currently passes `id` to its action calls
  // (dual-accepted by the backend either way), so nothing else reads this
  // yet.
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
