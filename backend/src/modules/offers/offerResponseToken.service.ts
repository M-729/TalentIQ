import crypto from "node:crypto";
import type { ClientSession } from "mongoose";
import { OfferResponseToken } from "../../models/OfferResponseToken.model";
import type { OfferDoc } from "../../models/Offer.model";
import { env } from "../../config/env";

function hashResponseToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * The effective expiry for a NEW response token: never later than
 * OFFER_RESPONSE_TOKEN_TTL_DAYS from now, and never later than the
 * Offer's own expires_at when one is set (see this ticket's explicit Part
 * 3 "effective response expiry should not extend past the Offer's own
 * expiration" rule) — a link must never outlive the offer it responds to.
 */
export function computeResponseTokenExpiry(offer: Pick<OfferDoc, "expires_at">): Date {
  const ttlExpiry = new Date(Date.now() + env.OFFER_RESPONSE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
  if (offer.expires_at && offer.expires_at < ttlExpiry) {
    return offer.expires_at;
  }
  return ttlExpiry;
}

/**
 * Generates a fresh, cryptographically random response token for ONE
 * actual email delivery attempt (the initial Send Offer, or a later Retry
 * Email — see offerEmail.service.ts, which calls this from both places).
 * Only the SHA-256 hash is ever persisted (see OfferResponseToken.model.ts's
 * own doc comment for why) — the raw value returned here is embedded in
 * the candidate email's Accept/Decline links and never stored anywhere
 * else, never logged.
 *
 * `session`, when passed, lets the initial "Send Offer" call create this
 * token INSIDE the same transaction as the Offer/Application/
 * EmailNotification writes — the same "durably persist before/with the
 * send" principle this ticket's earlier Offer/Rejection email hardening
 * already established, so a candidate email is never sent referencing a
 * token that didn't actually get persisted. A later "Retry Email" call
 * omits it: at that point the notification row already exists and there
 * is nothing else this token's creation needs to be atomic with, so a
 * plain single-document create (already atomic on its own) is sufficient.
 */
export async function generateOfferResponseToken(
  offer: Pick<OfferDoc, "id" | "company_id" | "expires_at">,
  notificationId: string | null,
  session?: ClientSession
): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("hex");

  await OfferResponseToken.create(
    [
      {
        company_id: offer.company_id,
        offer_id: offer.id,
        notification_id: notificationId,
        token_hash: hashResponseToken(rawToken),
        expires_at: computeResponseTokenExpiry(offer),
      },
    ],
    session ? { session } : {}
  );

  return rawToken;
}

export { hashResponseToken };
