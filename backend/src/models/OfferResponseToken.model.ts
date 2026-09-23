import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * A secure, opaque, single-purpose token that lets a candidate — who has
 * NO TalentIQ account — respond to exactly one Offer's Accept/Decline
 * email links without authenticating. Mirrors GoogleOAuthState.model.ts's
 * and RefreshToken.model.ts's exact "never store the usable secret
 * itself" precedent: the raw token is generated server-side
 * (crypto.randomBytes), handed to the candidate embedded in the email
 * link, and only its SHA-256 hash is ever persisted here — a database
 * read/leak alone can never be used to forge a valid response link. See
 * offerResponseToken.service.ts for generation/lookup.
 *
 * Deliberately its OWN model, not a field on Offer or EmailNotification:
 * - Offer is the durable business record — it must never carry a live
 *   security secret or its hash (a secret has a fundamentally different
 *   lifecycle/rotation/expiry concern than an offer's business terms).
 * - EmailNotification.offer_snapshot is the immutable, frozen BUSINESS
 *   content of one email event — a token (or a tokenized URL) is
 *   delivery/security infrastructure, not historical content, and must
 *   never be persisted there either (see offerEmail.service.ts's own doc
 *   comment on this exact point).
 *
 * One token is generated per actual email delivery attempt that needs
 * response links (the initial Send Offer, and again on every "Retry
 * Email" — see offerEmail.service.ts): plaintext tokens are never stored,
 * so a failed-send retry cannot recover an old plaintext value and must
 * mint a fresh one. Older, still-unexpired tokens for the same Offer
 * remain independently valid for as long as Offer.status === "sent" —
 * there is no need to revoke them just because a newer one was minted
 * (see this ticket's explicit Part 2). `used_at` is set only once THIS
 * token is the one that actually causes a successful Offer transition;
 * it is informational/audit only — the REAL guard against any token
 * mutating an Offer that has moved on is Offer.status itself, checked
 * atomically at respond time (see offerResponse.service.ts).
 */
const offerResponseTokenSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    offer_id: { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    // The specific offer_sent EmailNotification row this token's link was
    // delivered with — nullable only for defensive/future flexibility;
    // every token created today always sets it (see offerEmail.service.ts).
    notification_id: { type: Schema.Types.ObjectId, ref: "EmailNotification", default: null },
    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },
    used_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// TTL cleanup — expired tokens are useless (lookup/respond already reject
// anything past expires_at) and would otherwise accumulate forever, same
// pattern as GoogleOAuthState.model.ts / RefreshToken.model.ts.
offerResponseTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

// Serves "every response token ever issued for this Offer" — used only for
// defensive/audit reads, never for the actual respond-time authorization
// decision (which is always a single token_hash lookup).
offerResponseTokenSchema.index({ offer_id: 1 });

export type OfferResponseTokenDoc = HydratedDocument<InferSchemaType<typeof offerResponseTokenSchema>>;

export const OfferResponseToken = model("OfferResponseToken", offerResponseTokenSchema);
