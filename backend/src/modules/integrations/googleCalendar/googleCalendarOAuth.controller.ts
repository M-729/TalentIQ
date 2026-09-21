import type { Request, Response } from "express";
import { env } from "../../../config/env";
import { asyncHandler } from "../../../utils/asyncHandler";
import { getAuthorizationUrl, exchangeCodeForTokens, revokeRefreshToken } from "./googleCalendarOAuth.service";
import { createOAuthState, consumeOAuthState } from "./googleCalendarOAuthState.service";
import {
  decryptConnectionRefreshToken,
  getActiveConnection,
  getActiveConnectionMetadata,
  revokeConnection,
  upsertConnection,
} from "./googleCalendarConnection.service";

const FRONTEND_REDIRECT_BASE = () => `${env.FRONTEND_URL}/settings/integrations`;

// Authenticated JSON endpoint (Bearer token, this app's normal API
// style) — deliberately NOT a server-side redirect straight to Google.
// A raw browser navigation can't carry this app's Authorization header,
// so requireAuth could never run on an endpoint the browser navigates to
// directly; returning { url } instead lets the (future) frontend fetch()
// this normally, then perform the actual top-level navigation itself.
export const connectHandler = asyncHandler(async (req: Request, res: Response) => {
  const state = await createOAuthState(req.auth!.userId, req.auth!.companyId);
  const url = getAuthorizationUrl(state);
  res.status(200).json({ url });
});

/**
 * Reached via a raw browser redirect FROM Google — never has an
 * Authorization header, so it deliberately has no requireAuth (see
 * googleCalendarOAuth.routes.ts). Identity comes entirely from
 * consumeOAuthState successfully consuming a state record that an
 * earlier authenticated /connect call created — that IS this route's
 * authorization check.
 *
 * Every outcome (success or any failure) ends in a redirect back to the
 * frontend, never a bare JSON error shown in the browser, and never with
 * provider tokens/errors in the redirect query string — only a coarse
 * safe indicator (?googleCalendar=connected|error).
 */
export async function callbackHandler(req: Request, res: Response): Promise<void> {
  const redirectBase = FRONTEND_REDIRECT_BASE();

  try {
    const { code, state } = req.query;
    if (typeof code !== "string" || typeof state !== "string" || !code || !state) {
      res.redirect(`${redirectBase}?googleCalendar=error`);
      return;
    }

    const consumedState = await consumeOAuthState(state);
    if (!consumedState) {
      // Invalid, expired, or already-used state — never distinguished to
      // the caller (see consumeOAuthState's own doc comment).
      res.redirect(`${redirectBase}?googleCalendar=error`);
      return;
    }

    const exchanged = await exchangeCodeForTokens(code);

    await upsertConnection({
      userId: consumedState.userId,
      companyId: consumedState.companyId,
      email: exchanged.accountEmail,
      refreshToken: exchanged.refreshToken,
      scopes: exchanged.scopes,
    });

    res.redirect(`${redirectBase}?googleCalendar=connected`);
  } catch {
    // Deliberately no error detail logged here — this path can be
    // reached by a malformed/adversarial request before any of our own
    // code even runs, and whatever googleapis' own exchange error
    // contains is exactly the kind of raw provider detail this ticket
    // says must never be logged/exposed.
    res.redirect(`${redirectBase}?googleCalendar=error`);
  }
}

export const statusHandler = asyncHandler(async (req: Request, res: Response) => {
  const connection = await getActiveConnectionMetadata(req.auth!.userId);
  if (!connection) {
    res.status(200).json({ connected: false });
    return;
  }
  res.status(200).json({
    connected: true,
    account_email: connection.google_account_email,
    connected_at: connection.connected_at.toISOString(),
  });
});

export const disconnectHandler = asyncHandler(async (req: Request, res: Response) => {
  const connection = await getActiveConnection(req.auth!.userId);
  if (!connection) {
    // Already disconnected — idempotent, not an error.
    res.status(204).send();
    return;
  }

  // Best-effort — a revocation failure (Google already expired it,
  // network issue) must never block local cleanup below.
  await revokeRefreshToken(decryptConnectionRefreshToken(connection));
  await revokeConnection(req.auth!.userId);

  res.status(204).send();
});
