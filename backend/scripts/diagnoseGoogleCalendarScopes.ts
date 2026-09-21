/**
 * DEV-ONLY diagnostic — not an HTTP endpoint, not wired into app.ts. Never
 * mutates the database or the stored connection; read-only, and it never
 * requests a new token from Google (no reconnect) — it only inspects the
 * ACCESS TOKEN Google issues right now from the ALREADY-stored refresh
 * token, via Google's own tokeninfo introspection.
 *
 * Exists because `granted_scopes` (stored at OAuth-callback time — see
 * googleCalendarOAuth.service.ts's exchangeCodeForTokens) is not proof of
 * what the refresh token can ACTUALLY do: when Google's token response
 * omits `scope` entirely, that code silently assumes every REQUESTED
 * scope was granted, rather than confirming it. This script asks Google
 * directly, independent of whatever TalentIQ has stored.
 *
 * Usage:
 *   npx ts-node scripts/diagnoseGoogleCalendarScopes.ts <talentiqUserId>
 *
 * Prints ONLY: the connected Google account email, the stored
 * granted_scopes, the scopes Google's tokeninfo endpoint actually reports
 * for the current access token, and whether calendar.events is among
 * them. NEVER prints: the refresh token, the access token, the client
 * secret, the encryption key, an authorization code, or any raw Google
 * response body/message.
 */
import { google } from "googleapis";
import { connectDB, disconnectDB } from "../src/config/db";
import { env } from "../src/config/env";
import { getActiveConnection, decryptConnectionRefreshToken } from "../src/modules/integrations/googleCalendar/googleCalendarConnection.service";

const REQUIRED_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function requireOAuthEnv(): { clientId: string; clientSecret: string; redirectUri: string } {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI) {
    throw new Error("Google OAuth is not configured (GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET/GOOGLE_REDIRECT_URI)");
  }
  return { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: env.GOOGLE_REDIRECT_URI };
}

/** Only a status code and Google's short structured `reason`/`status` token — never the raw error body/message. */
function safeErrorInfo(err: unknown): { status?: number; reason?: string } {
  if (typeof err !== "object" || err === null) return {};
  const withResponse = err as { code?: unknown; response?: { status?: unknown; data?: unknown } };
  const status =
    typeof withResponse.response?.status === "number"
      ? withResponse.response.status
      : typeof withResponse.code === "number"
        ? withResponse.code
        : undefined;

  const data = withResponse.response?.data;
  let reason: string | undefined;
  if (typeof data === "object" && data !== null) {
    const apiError = (data as { error?: unknown }).error;
    if (typeof apiError === "object" && apiError !== null) {
      const errors = (apiError as { errors?: unknown }).errors;
      if (Array.isArray(errors) && errors.length > 0) {
        const r = (errors[0] as { reason?: unknown } | undefined)?.reason;
        if (typeof r === "string") reason = r;
      }
      if (!reason) {
        const s = (apiError as { status?: unknown }).status;
        if (typeof s === "string") reason = s;
      }
    }
  }
  return { status, reason };
}

async function main(): Promise<void> {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: npx ts-node scripts/diagnoseGoogleCalendarScopes.ts <talentiqUserId>");
    process.exitCode = 1;
    return;
  }

  const { clientId, clientSecret, redirectUri } = requireOAuthEnv();

  await connectDB();
  try {
    const connection = await getActiveConnection(userId);
    if (!connection) {
      console.log("[diagnose] No active Google Calendar connection for this user.");
      return;
    }

    // Decrypted only into a local variable for this one call — never
    // logged, never persisted anywhere else.
    const refreshToken = decryptConnectionRefreshToken(connection);

    const client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
    client.setCredentials({ refresh_token: refreshToken });

    let accessToken: string | null | undefined;
    try {
      const accessTokenResponse = await client.getAccessToken();
      accessToken = accessTokenResponse.token;
    } catch (err) {
      const { status, reason } = safeErrorInfo(err);
      console.log("[diagnose] Failed to obtain an access token from the stored refresh token.");
      console.log(`[diagnose] status=${status ?? "unknown"} reason=${reason ?? "unknown"}`);
      return;
    }

    if (!accessToken) {
      console.log("[diagnose] Google did not return an access token for the stored refresh token.");
      return;
    }

    let actualScopes: string[] = [];
    try {
      // OAuth2Client.getTokenInfo — inspects the ACCESS token (never the
      // refresh token) via Google's own tokeninfo introspection.
      const tokenInfo = await client.getTokenInfo(accessToken);
      actualScopes = tokenInfo.scopes ?? [];
    } catch (err) {
      const { status, reason } = safeErrorInfo(err);
      console.log("[diagnose] Failed to introspect the access token via getTokenInfo.");
      console.log(`[diagnose] status=${status ?? "unknown"} reason=${reason ?? "unknown"}`);
      return;
    }

    const storedScopes = connection.granted_scopes ?? [];
    const hasCalendarEventsScope = actualScopes.includes(REQUIRED_CALENDAR_SCOPE);

    console.log("[diagnose] Google account email:", connection.google_account_email);
    console.log("[diagnose] Stored granted_scopes:", storedScopes);
    console.log("[diagnose] Actual scopes on the current access token (per Google):", actualScopes);
    console.log("[diagnose] calendar.events actually present:", hasCalendarEventsScope);
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  // Deliberately generic — never the raw error, which could originate
  // from anywhere in this script's dependency chain.
  console.error("[diagnose] Diagnostic failed:", err instanceof Error ? err.name : "unknown error");
  process.exitCode = 1;
});
