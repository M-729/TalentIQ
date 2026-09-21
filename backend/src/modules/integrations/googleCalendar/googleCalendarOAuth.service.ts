import { google } from "googleapis";
import { env } from "../../../config/env";

// The minimum practical Calendar scope for creating/updating/deleting
// events — deliberately NOT the broad `calendar` scope (full
// read/write/manage access to every calendar), and deliberately no
// Gmail/Drive/Profile scopes, which this integration has no use for.
// `openid` + `userinfo.email` are the minimal additional scopes needed to
// learn WHICH Google account connected (see exchangeCodeForTokens below)
// — without it, GoogleCalendarConnection.google_account_email and the
// /status endpoint's account_email would have no way to be populated, and
// HR would have no way to tell which of several connected accounts owns
// a given Interview's Calendar event.
export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
] as const;

function buildOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI)");
  }
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_REDIRECT_URI);
}

/**
 * Builds the Google consent screen URL. `access_type: "offline"` is what
 * makes Google willing to issue a refresh_token at all; `prompt:
 * "consent"` forces Google to re-issue one on every connect (including a
 * reconnect), which is what keeps the "Google omitted refresh_token"
 * case in exchangeCodeForTokens/upsertConnection rare rather than the
 * common case — it's still handled defensively either way.
 */
export function getAuthorizationUrl(state: string): string {
  const client = buildOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [...GOOGLE_CALENDAR_SCOPES],
    state,
  });
}

export interface ExchangedGoogleTokens {
  /** null when Google omitted it (see getAuthorizationUrl's doc comment) — callers must never treat this as "clear the existing token". */
  refreshToken: string | null;
  accountEmail: string;
  scopes: string[];
}

/**
 * Exchanges an OAuth authorization code for tokens, server-side only —
 * the access token, refresh token, and this app's client secret never
 * leave this function's stack frame (never logged, never returned to a
 * caller beyond the normalized shape below, never put in a URL). The
 * connected account's email is read from the verified ID token (requires
 * the `openid` scope) rather than an extra userinfo API call.
 */
export async function exchangeCodeForTokens(code: string): Promise<ExchangedGoogleTokens> {
  const client = buildOAuthClient();

  const { tokens } = await client.getToken(code);

  if (!tokens.id_token) {
    throw new Error("google_missing_identity_token");
  }

  const ticket = await client.verifyIdToken({ idToken: tokens.id_token, audience: env.GOOGLE_CLIENT_ID! });
  const email = ticket.getPayload()?.email;
  if (!email) {
    throw new Error("google_missing_account_email");
  }

  return {
    refreshToken: tokens.refresh_token ?? null,
    accountEmail: email.toLowerCase(),
    scopes: tokens.scope ? tokens.scope.split(" ") : [...GOOGLE_CALENDAR_SCOPES],
  };
}

/**
 * Best-effort revocation — a failure here (Google already expired it,
 * network issue, etc.) must never block local disconnect cleanup; the
 * caller proceeds with revoking the local connection record regardless
 * of this function's return value.
 */
export async function revokeRefreshToken(refreshToken: string): Promise<boolean> {
  try {
    const client = buildOAuthClient();
    await client.revokeToken(refreshToken);
    return true;
  } catch {
    return false;
  }
}
