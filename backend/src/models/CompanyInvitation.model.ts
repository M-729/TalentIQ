import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";
import { EMAIL_NOTIFICATION_STATUSES, EMAIL_FAILURE_CODES } from "./EmailNotification.model";

// Stored lifecycle values. Deliberately no separate "expired" status:
// expiry is a function of time (expires_at), not a state transition anyone
// writes — a "pending" invitation past its expires_at is *derived* as
// expired at read time (see companyInvitationResponse.serializer.ts's
// deriveInvitationState), the same way Offer/offerResponse derive
// "expired" from Offer.status="sent" + Offer.expires_at rather than
// storing it as its own status. This keeps exactly one atomic guard
// (`{status:"pending", expires_at:{$gt: now}}`) authoritative for whether
// an invitation can still be accepted, instead of needing a background job
// to flip stale rows to "expired".
export const COMPANY_INVITATION_STATUSES = ["pending", "accepted", "revoked"] as const;
export type CompanyInvitationStatus = (typeof COMPANY_INVITATION_STATUSES)[number];

// The only role this ticket's invitation flow may ever grant — see this
// ticket's explicit "Do NOT allow arbitrary ADMIN creation through
// invitations" rule. Kept as its own const (rather than reusing
// USER_ROLES) so the invitation service has one place to defend "HR only"
// even though the schema's `role` field stores a full UserRole value for
// forward compatibility.
export const INVITABLE_ROLES = ["HR"] as const;

/**
 * A secure, opaque, single-purpose invitation for exactly one email
 * address to join exactly one Company, as exactly one role — the
 * self-service counterpart to a Company being created via signup. Mirrors
 * OfferResponseToken.model.ts's exact "never store the usable secret
 * itself" precedent: the raw token is generated server-side
 * (crypto.randomBytes), handed to the invitee embedded in the invitation
 * email link, and only its SHA-256 hash is ever persisted here.
 *
 * Unlike OfferResponseToken (which is pure, disposable security infra with
 * a TTL index that lets Mongo physically delete expired rows), this model
 * is ALSO the durable audit record this ticket's Part 17 requires (who
 * invited, when, accepted when/by whom, revoked when) — so it deliberately
 * has NO TTL index. An expired invitation is simply unusable (see
 * expires_at above); it stays visible in the Admin's Pending Invitations
 * history rather than silently disappearing.
 *
 * One token per invitation, not one token per "delivery attempt" (unlike
 * OfferResponseToken, which mints a new row per retry so older valid links
 * can coexist). A "Resend"/"Retry Email" action here overwrites this same
 * document's token_hash + expires_at in place, deliberately invalidating
 * any earlier email's link — there is exactly one invitee per invitation,
 * so there is no scenario (unlike an Offer, which may have already been
 * opened via an earlier email) where an old link needs to keep working
 * after a newer one was issued. See companyInvitation.service.ts's
 * resendTeamInvitation for where this happens.
 */
const companyInvitationSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    role: { type: String, enum: INVITABLE_ROLES, required: true },
    status: { type: String, enum: COMPANY_INVITATION_STATUSES, required: true, default: "pending" },

    invited_by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

    token_hash: { type: String, required: true, unique: true },
    expires_at: { type: Date, required: true },

    accepted_at: { type: Date, default: null },
    // The User this invitation actually produced — nullable until accepted,
    // audit-only (never used as an authorization check; the atomic
    // status+expiry guard at accept time is what actually decides
    // eligibility — see companyInvitationResponse.service.ts).
    accepted_user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },
    revoked_at: { type: Date, default: null },

    // Email delivery tracking, kept minimal and local to this model rather
    // than forced through EmailNotification (whose schema requires
    // application_id/candidate_id — a recruitment-domain shape this
    // company/team-onboarding concern has no business faking values for).
    // Reuses EmailNotification's own status/failure-code vocabulary for
    // consistency, not its schema.
    email_status: { type: String, enum: EMAIL_NOTIFICATION_STATUSES, required: true, default: "pending" },
    email_failure_code: { type: String, enum: [...EMAIL_FAILURE_CODES, null], default: null },
    email_attempted_at: { type: Date, default: null },
    email_sent_at: { type: Date, default: null },
    email_attempt_count: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Enforces this ticket's Part 11 "normally only one active/pending
// invitation per company+email" rule at the database level, not just in
// service-layer logic — a plain equality partialFilterExpression (not $ne/
// $in, which Mongo does not support in a partial index) so it's a genuine,
// enforced unique constraint.
companyInvitationSchema.index(
  { company_id: 1, email: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } }
);

export type CompanyInvitationDoc = HydratedDocument<InferSchemaType<typeof companyInvitationSchema>>;

export const CompanyInvitation = model("CompanyInvitation", companyInvitationSchema);
