import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

/**
 * The four fields an authenticated-encryption payload needs to safely
 * decrypt later — see security/googleTokenEncryption.ts. Never a single
 * opaque string: ciphertext/iv/auth_tag are stored as explicit typed
 * fields, not a generic Mixed blob, matching this codebase's established
 * "no Mixed fields" convention.
 */
const encryptedRefreshTokenSchema = new Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    auth_tag: { type: String, required: true },
  },
  { _id: false }
);

/**
 * A TalentIQ User's connection to their own Google account, used to
 * create/update/cancel Calendar events on that user's behalf (see
 * modules/integrations/googleCalendar/). Deliberately its own model, not
 * fields on User.model.ts — OAuth credentials are a distinct, sensitive
 * concern with its own lifecycle (connect/reconnect/disconnect), and
 * keeping it separate means a normal User read never has any chance of
 * touching encrypted token material.
 *
 * `select: false` on encrypted_refresh_token mirrors User.password_hash's
 * own precedent — a normal query never returns it; only the sync code
 * that's about to actually call Google explicitly selects it.
 *
 * Soft-revoked (never hard-deleted) on disconnect, mirroring
 * RefreshToken.model.ts's own revoked_at pattern in this codebase — this
 * preserves a connection history/audit trail rather than destroying it.
 * "One active connection per User" is enforced by the partial unique
 * index below (revoked_at: null), so reconnecting after a disconnect
 * creates a new active document rather than colliding with the revoked
 * one.
 */
const googleCalendarConnectionSchema = new Schema(
  {
    user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    // Denormalized from the User at connect time — lets connection
    // lookups/admin queries stay company-scoped without an extra User
    // join, matching this codebase's established denormalization
    // rationale (see ApplicationStageTransition.model.ts's job_id).
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true },

    google_account_email: { type: String, required: true, trim: true, lowercase: true },

    encrypted_refresh_token: { type: encryptedRefreshTokenSchema, required: true, select: false },
    granted_scopes: { type: [String], default: [] },

    // Whether Google's own token introspection confirmed (at the most
    // recent connect/reconnect) that the required calendar.events scope
    // is ACTUALLY present on the issued access token — never inferred
    // from granted_scopes/the OAuth response's optional `scope` field,
    // and never assumed from the scopes this app requested (see
    // googleCalendarOAuth.service.ts's exchangeCodeForTokens doc comment
    // for the production incident this hardens against: Google can
    // silently restrict a sensitive scope without any consent-time
    // error). Defaults false — a connection is never presented as ready
    // until this is verified true.
    calendar_permission_granted: { type: Boolean, required: true, default: false },

    connected_at: { type: Date, required: true },
    revoked_at: { type: Date, default: null },
  },
  {
    // No created_at — connected_at already records when the currently
    // active connection was established, and re-records it again on
    // every reconnect (see googleCalendarOAuth.service.ts).
    timestamps: { createdAt: false, updatedAt: "updated_at" },
  }
);

// The exact query every provider-sync call makes: "this User's current
// active Google connection". Partial (not a plain unique index) so a
// disconnected (revoked_at set) historical record never blocks a later
// reconnect from creating a new active one.
googleCalendarConnectionSchema.index({ user_id: 1 }, { unique: true, partialFilterExpression: { revoked_at: null } });

export type GoogleCalendarConnectionDoc = HydratedDocument<InferSchemaType<typeof googleCalendarConnectionSchema>>;

export const GoogleCalendarConnection = model("GoogleCalendarConnection", googleCalendarConnectionSchema);
