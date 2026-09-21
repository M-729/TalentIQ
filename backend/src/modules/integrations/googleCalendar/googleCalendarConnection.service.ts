import { GoogleCalendarConnection, type GoogleCalendarConnectionDoc } from "../../../models/GoogleCalendarConnection.model";
import { decryptToken, encryptToken, type EncryptedTokenPayload } from "../../../security/googleTokenEncryption";

/**
 * The current active (not revoked) connection for a TalentIQ User, with
 * the encrypted refresh token explicitly selected (it's `select: false`
 * by default — see GoogleCalendarConnection.model.ts) since callers that
 * reach for this function are about to decrypt and use it.
 */
export async function getActiveConnection(userId: string): Promise<GoogleCalendarConnectionDoc | null> {
  return GoogleCalendarConnection.findOne({ user_id: userId, revoked_at: null }).select("+encrypted_refresh_token");
}

/** Existence-only check — never selects the encrypted token. */
export async function hasActiveConnection(userId: string): Promise<boolean> {
  return (await GoogleCalendarConnection.exists({ user_id: userId, revoked_at: null })) !== null;
}

/**
 * For the status endpoint — metadata only (email/connected_at), never
 * the encrypted token field (excluded by the schema's own `select: false`
 * default; this function deliberately never overrides that).
 */
export async function getActiveConnectionMetadata(userId: string): Promise<GoogleCalendarConnectionDoc | null> {
  return GoogleCalendarConnection.findOne({ user_id: userId, revoked_at: null });
}

export function decryptConnectionRefreshToken(connection: GoogleCalendarConnectionDoc): string {
  return decryptToken(connection.encrypted_refresh_token);
}

export interface UpsertConnectionParams {
  userId: string;
  companyId: string;
  email: string;
  /** null when Google omitted it on a re-consent — see this function's doc comment. */
  refreshToken: string | null;
  scopes: string[];
  /** Verified via Google's own token introspection — see googleCalendarOAuth.service.ts's exchangeCodeForTokens. Always (re)written on every connect/reconnect, unlike encrypted_refresh_token below. */
  calendarPermissionGranted: boolean;
}

/**
 * Connects or reconnects a User's Google Calendar. Uses a guarded
 * findOneAndUpdate first (never fetch-then-save — avoids any ambiguity
 * around resaving a document whose select:false token field wasn't
 * loaded) so that reconnecting an ALREADY-connected User safely updates
 * metadata in place. `encrypted_refresh_token` is only ever included in
 * the update when Google actually returned a new refresh_token — Google
 * omits it on some re-consents, and this is what prevents that from
 * silently overwriting a valid stored token with nothing (see this
 * ticket's explicit warning about reconnection).
 *
 * A genuinely first-time connect with no refresh token at all has
 * nothing usable to persist and fails outright — there would be no way
 * to ever refresh an access token for it.
 */
export async function upsertConnection(params: UpsertConnectionParams): Promise<GoogleCalendarConnectionDoc> {
  const setFields: {
    company_id: string;
    google_account_email: string;
    granted_scopes: string[];
    calendar_permission_granted: boolean;
    connected_at: Date;
    encrypted_refresh_token?: EncryptedTokenPayload;
  } = {
    company_id: params.companyId,
    google_account_email: params.email,
    granted_scopes: params.scopes,
    // Always re-written on every connect/reconnect — unlike
    // encrypted_refresh_token below, there's no "Google omitted this"
    // ambiguity here: every exchange verifies it fresh.
    calendar_permission_granted: params.calendarPermissionGranted,
    connected_at: new Date(),
  };
  if (params.refreshToken) {
    setFields.encrypted_refresh_token = encryptToken(params.refreshToken);
  }

  const updated = await GoogleCalendarConnection.findOneAndUpdate(
    { user_id: params.userId, revoked_at: null },
    { $set: setFields },
    { new: true }
  );
  if (updated) {
    return updated;
  }

  if (!params.refreshToken) {
    throw new Error("google_missing_refresh_token");
  }

  return GoogleCalendarConnection.create({
    user_id: params.userId,
    company_id: params.companyId,
    google_account_email: params.email,
    encrypted_refresh_token: encryptToken(params.refreshToken),
    granted_scopes: params.scopes,
    calendar_permission_granted: params.calendarPermissionGranted,
    connected_at: new Date(),
  });
}

/** Soft-revokes the User's active connection, if any — never hard-deletes (see model doc comment). */
export async function revokeConnection(userId: string): Promise<GoogleCalendarConnectionDoc | null> {
  return GoogleCalendarConnection.findOneAndUpdate(
    { user_id: userId, revoked_at: null },
    { $set: { revoked_at: new Date() } },
    { new: true }
  );
}
