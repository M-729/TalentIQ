import { Schema, model, type InferSchemaType, type HydratedDocument } from "mongoose";

// Deliberately small and linear — no "revised"/"countered" states. Per this
// ticket's explicit "prefer Withdraw + new Offer if simpler" guidance: if
// HR needs different terms after sending, the sent Offer is withdrawn (its
// terms stay locked, historically intact) and a brand-new Offer document is
// created, rather than building a revision/versioning workflow.
export const OFFER_STATUSES = ["draft", "sent", "accepted", "declined", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

// No existing currency convention was found anywhere in this codebase —
// Job.salary_min/salary_max are plain, currency-less Numbers (see
// Job.model.ts). Rather than inventing a bespoke system, this uses a small
// fixed set of common ISO 4217 codes, exactly as this ticket's Part 8
// suggests. Flagged in the task report as a new convention, not a reused
// one.
export const OFFER_CURRENCIES = ["USD", "EUR", "GBP", "LBP"] as const;
export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];

// Who actually recorded the accepted/declined outcome — candidate (via the
// public response link) or HR (manual fallback, e.g. a phone/email
// response). See offer.service.ts's applyOfferResponse, the single shared
// core both paths call, which is what keeps this from ever drifting
// between the two entry points.
export const OFFER_RESPONSE_SOURCES = ["candidate", "hr"] as const;
export type OfferResponseSource = (typeof OFFER_RESPONSE_SOURCES)[number];

/**
 * A single, persistent hiring offer extended to a candidate for one
 * Application. TalentIQ never generates a PDF/contract/e-signature here —
 * this is purely the record of "these are the terms HR offered, and how
 * the candidate responded" (see this ticket's explicit "do not build a
 * legal contract builder" rule).
 *
 * Lifecycle (see offer.service.ts for the guarded transitions):
 *   draft -> sent -> accepted
 *                 -> declined
 *   draft -> withdrawn
 *   sent  -> withdrawn
 * accepted/declined/withdrawn are all terminal for this ONE Offer document
 * — never un-accepted, un-declined, or un-withdrawn. "Mark as Hired" is an
 * Application-level transition (see Application.model.ts's hired_at), not
 * a further Offer status; the Offer that led to it simply stays "accepted"
 * forever as the historical record.
 *
 * At most one NON-withdrawn Offer may exist per Application at a time (see
 * the partial unique index below) — a withdrawn Offer remains permanently
 * queryable (company-wide on the Offers page, and as history), but never
 * blocks a fresh Offer from being created for the same Application.
 *
 * Deliberately NOT Mongo Mixed anywhere, matching this codebase's existing
 * convention (ApplicationAssessment.model.ts, Interview.model.ts, ...).
 */
const offerSchema = new Schema(
  {
    company_id: { type: Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    application_id: { type: Schema.Types.ObjectId, ref: "Application", required: true },
    // Denormalized from the Application at creation time — same rationale
    // as ApplicationAssessment.model.ts's own candidate_id/job_id fields:
    // lets tenant/list queries avoid an extra Application lookup, and
    // stays valid even after the Job is later soft-deleted.
    candidate_id: { type: Schema.Types.ObjectId, ref: "Candidate", required: true },
    job_id: { type: Schema.Types.ObjectId, ref: "Job", required: true },

    status: { type: String, enum: OFFER_STATUSES, required: true, default: "draft" },

    title: { type: String, required: true, trim: true, maxlength: 150 },
    // Salary is entirely optional — many real offers are communicated
    // outside TalentIQ, or simply not tracked here. When present, always
    // paired with a currency (enforced in offer.validation.ts) so a bare
    // number is never ambiguous.
    salary_amount: { type: Number, min: 0, default: null },
    salary_currency: { type: String, enum: [...OFFER_CURRENCIES, null], default: null },
    // Free text, matching Job.employment_type's own convention (the ERD
    // gives no enumerated values for employment type anywhere).
    employment_type: { type: String, trim: true, default: null },
    start_date: { type: Date, default: null },
    expires_at: { type: Date, default: null },

    // The ONLY candidate-facing free text on this record — included
    // verbatim in the offer email (see offerEmail.service.ts). Never
    // internal_notes below.
    candidate_message: { type: String, trim: true, maxlength: 4000, default: null },
    // HR-only — NEVER included in the offer email or any candidate-facing
    // surface (see this ticket's explicit Part 9/19 "do not include
    // internal notes" rule).
    internal_notes: { type: String, trim: true, maxlength: 4000, default: null },

    created_by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
    updated_by_user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },

    sent_at: { type: Date, default: null },
    accepted_at: { type: Date, default: null },
    declined_at: { type: Date, default: null },
    withdrawn_at: { type: Date, default: null },

    // ===== Response-source audit (Candidate Offer Accept/Decline ticket) =====
    // Set only when status becomes "accepted" or "declined" — null for
    // draft/sent/withdrawn. "candidate" means the candidate themselves
    // confirmed through the public response link with no TalentIQ account
    // involved; "hr" means an authenticated HR/Admin user recorded a
    // response received outside TalentIQ (phone, ordinary email, ...).
    // Both paths set these three fields together, atomically, through the
    // exact same applyOfferResponse core (see offer.service.ts) — never
    // set independently, so they can never drift out of sync with
    // accepted_at/declined_at.
    response_source: { type: String, enum: [...OFFER_RESPONSE_SOURCES, null], default: null },
    responded_at: { type: Date, default: null },
    // Null for a candidate response (no TalentIQ user is involved) — set
    // to the authenticated HR/Admin user's id for a manual response.
    responded_by_user_id: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // A pure indexing helper, never read by application code and never
    // exposed on any DTO — MongoDB's partialFilterExpression only supports
    // equality/$exists/comparison operators, NOT $ne or $in (see the index
    // below), so "every status except withdrawn" cannot be expressed
    // directly against `status` itself. This field always mirrors
    // `status !== "withdrawn"` and is flipped to false in the exact same
    // update that sets status to "withdrawn" (see offer.service.ts's
    // withdrawOffer) — never set independently anywhere else.
    is_live: { type: Boolean, required: true, default: true },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// At most one LIVE (non-withdrawn) Offer per Application — see this
// model's own doc comment and is_live's own doc comment above. A withdrawn
// Offer no longer matches this partial filter, so creating a genuinely
// new Offer afterward is never blocked by an old, explicitly-withdrawn one.
offerSchema.index({ application_id: 1 }, { unique: true, partialFilterExpression: { is_live: true } });

// Serves the /offers company-wide list (optionally filtered by
// job_id/status), and "an Application's own Offer history", directly from
// an index — mirrors ApplicationAssessment.model.ts's own listing indexes.
offerSchema.index({ company_id: 1, created_at: -1 });
offerSchema.index({ company_id: 1, job_id: 1 });
offerSchema.index({ company_id: 1, status: 1 });
offerSchema.index({ application_id: 1, created_at: -1 });

export type OfferDoc = HydratedDocument<InferSchemaType<typeof offerSchema>>;

export const Offer = model("Offer", offerSchema);
