import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * A short-lived, one-time-use CSRF token for the Google OAuth connect
 * flow. The raw state value is generated server-side (crypto.randomBytes)
 * and handed to Google as the `state` query param; only its SHA-256 hash
 * is ever persisted here (same "never store the usable secret itself"
 * principle as RefreshToken.model.ts's token_hash) — a database read/leak
 * alone can't be used to forge a valid OAuth callback.
 *
 * `user_id`/`company_id` are what let the callback re-establish WHICH
 * TalentIQ user is completing the flow without any Authorization header
 * being available (a raw browser redirect from Google can't carry one —
 * see googleCalendarOAuth.routes.ts's doc comment on why /callback has no
 * requireAuth). Consuming a valid state record IS the callback's proof of
 * identity.
 *
 * `consumed_at` plus the atomic guarded update in
 * googleCalendarOAuth.service.ts's consumeState (findOneAndUpdate on
 * { state_hash, consumed_at: null, expires_at: { $gt: now } }) is what
 * makes this safely one-time-use even under a replayed/duplicated
 * callback request.
 */
const googleOAuthStateSchema = new Schema(
  {
    state_hash: { type: String, required: true, unique: true },
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    expires_at: { type: Date, required: true },
    consumed_at: { type: Date, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: false },
  }
);

// TTL cleanup — expired state records are useless (consumeState already
// rejects anything past expires_at) and would otherwise accumulate
// forever, same pattern as RefreshToken.model.ts's own TTL index.
googleOAuthStateSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

export type GoogleOAuthStateDoc = HydratedDocument<InferSchemaType<typeof googleOAuthStateSchema>>;

export const GoogleOAuthState = model("GoogleOAuthState", googleOAuthStateSchema);
