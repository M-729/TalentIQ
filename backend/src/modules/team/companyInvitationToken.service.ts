import crypto from "crypto";
import { env } from "../../config/env";

/**
 * Generation/hashing for CompanyInvitation's opaque token — mirrors
 * OfferResponseToken's exact pattern (security/tokens.ts's refresh-token
 * hashing precedent, reapplied here): a cryptographically random raw value
 * is generated, only its SHA-256 hash is ever persisted, and the raw value
 * is returned exactly once, for the caller to embed in the invitation
 * email link. It is never logged and never stored anywhere in plaintext.
 */
export function generateInvitationToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashInvitationToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/** COMPANY_INVITATION_TTL_DAYS from now — the single centralized source of an invitation's expiry, used both on initial invite and on every resend. */
export function computeInvitationExpiry(): Date {
  return new Date(Date.now() + env.COMPANY_INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);
}
