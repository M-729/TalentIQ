import crypto from "node:crypto";
import { GoogleOAuthState } from "../../../models/GoogleOAuthState.model";

const STATE_TTL_MS = 10 * 60 * 1000;

function hashState(rawState: string): string {
  return crypto.createHash("sha256").update(rawState).digest("hex");
}

/**
 * Creates a fresh, cryptographically random state value for the OAuth
 * connect flow. Only its hash is ever persisted (see
 * GoogleOAuthState.model.ts's doc comment) — the raw value returned here
 * is handed to Google as the `state` query param and never stored
 * anywhere else.
 */
export async function createOAuthState(userId: string, companyId: string): Promise<string> {
  const rawState = crypto.randomBytes(32).toString("hex");
  await GoogleOAuthState.create({
    state_hash: hashState(rawState),
    user_id: userId,
    company_id: companyId,
    expires_at: new Date(Date.now() + STATE_TTL_MS),
  });
  return rawState;
}

export interface ConsumedOAuthState {
  userId: string;
  companyId: string;
}

/**
 * Atomically consumes a raw state value from the callback: hashes it,
 * then a SINGLE guarded findOneAndUpdate matches only a record that is
 * both unexpired and not yet consumed, marking it consumed in the same
 * operation. This is what makes replay/double-use impossible even under
 * a duplicated/racing callback request — the same guarded-update
 * atomicity pattern this codebase already relies on for Interview
 * reschedule/cancel concurrency (MongoDB's own single-document
 * atomicity, no distributed lock needed).
 *
 * Returns null for every invalid case alike (unknown state, expired,
 * already consumed) — the caller (googleCalendarOAuth.routes.ts) never
 * distinguishes which one it was, so a caller probing with garbage state
 * values learns nothing about why a given attempt failed.
 */
export async function consumeOAuthState(rawState: string): Promise<ConsumedOAuthState | null> {
  const stateHash = hashState(rawState);
  const consumed = await GoogleOAuthState.findOneAndUpdate(
    { state_hash: stateHash, consumed_at: null, expires_at: { $gt: new Date() } },
    { $set: { consumed_at: new Date() } },
    { new: true }
  );
  if (!consumed) {
    return null;
  }
  return { userId: consumed.user_id.toString(), companyId: consumed.company_id.toString() };
}
