import type { OfferDoc, OfferResponseSource, OfferStatus } from "../../models/Offer.model";
import type { CandidateDoc } from "../../models/Candidate.model";
import type { JobDoc } from "../../models/Job.model";
import type { EmailNotificationDoc, EmailNotificationStatus } from "../../models/EmailNotification.model";

export interface OfferNotificationDTO {
  id: string;
  // Opaque, URL-facing identifier — absent only for a notification created
  // before this field existed and not yet covered by the backfill script.
  public_id?: string;
  status: EmailNotificationStatus;
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  /** A safe, provider-neutral code (e.g. "smtp_unavailable") — never a raw SMTP/Nodemailer error. Null unless status is "failed". */
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}

/** Mirrors rejection.serializer.ts's serializeRejectionNotification / the interview and assessment equivalents — same established per-category-family convention. */
export function serializeOfferNotification(doc: EmailNotificationDoc): OfferNotificationDTO {
  return {
    id: doc.id,
    public_id: doc.public_id ?? undefined,
    status: doc.status,
    subject: doc.subject,
    recipient_email: doc.recipient_email,
    attempted_at: doc.attempted_at ? doc.attempted_at.toISOString() : null,
    sent_at: doc.sent_at ? doc.sent_at.toISOString() : null,
    failure_code: doc.failure_code ?? null,
    attempt_count: doc.attempt_count,
    created_at: doc.created_at!.toISOString(),
  };
}

export interface OfferDTO {
  id: string;
  // Opaque, URL-facing identifier — absent only for an Offer created
  // before this field existed and not yet covered by the backfill script.
  public_id?: string;
  application_id: string;
  candidate_id: string;
  job_id: string;
  status: OfferStatus;
  title: string;
  salary_amount: number | null;
  salary_currency: string | null;
  employment_type: string | null;
  start_date: string | null;
  expires_at: string | null;
  candidate_message: string | null;
  // HR-only — this endpoint is authenticated HR/Admin-only, never
  // candidate-facing (see Offer.model.ts's internal_notes doc comment for
  // why it must never appear in the offer email itself).
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  withdrawn_at: string | null;
  /** "candidate" (via the public response link) or "hr" (manual fallback) — null until a response is recorded. See Offer.model.ts's own doc comment. */
  response_source: OfferResponseSource | null;
  responded_at: string | null;
  /** Only ever set for response_source === "hr" — a candidate response has no TalentIQ user to attribute it to. */
  responded_by: { id: string; name: string } | null;
}

/**
 * Explicit DTO — never a raw Mongoose document. Deliberately excludes
 * company_id/created_by_user_id/updated_by_user_id (internal ids not yet
 * useful to a client) and __v. `respondedByName` is resolved by the
 * caller (a plain User lookup, same pattern as rejection.serializer.ts's
 * serializeRejectionInfo) so this serializer never needs its own User
 * query — and callers skip that lookup entirely whenever
 * responded_by_user_id is null (the common case, before any response).
 */
export function serializeOffer(doc: OfferDoc, respondedByName: string | null = null): OfferDTO {
  return {
    id: doc.id,
    public_id: doc.public_id ?? undefined,
    application_id: doc.application_id.toString(),
    candidate_id: doc.candidate_id.toString(),
    job_id: doc.job_id.toString(),
    status: doc.status,
    title: doc.title,
    salary_amount: doc.salary_amount ?? null,
    salary_currency: doc.salary_currency ?? null,
    employment_type: doc.employment_type ?? null,
    start_date: doc.start_date ? doc.start_date.toISOString() : null,
    expires_at: doc.expires_at ? doc.expires_at.toISOString() : null,
    candidate_message: doc.candidate_message ?? null,
    internal_notes: doc.internal_notes ?? null,
    created_at: doc.created_at!.toISOString(),
    updated_at: doc.updated_at!.toISOString(),
    sent_at: doc.sent_at ? doc.sent_at.toISOString() : null,
    accepted_at: doc.accepted_at ? doc.accepted_at.toISOString() : null,
    declined_at: doc.declined_at ? doc.declined_at.toISOString() : null,
    withdrawn_at: doc.withdrawn_at ? doc.withdrawn_at.toISOString() : null,
    response_source: doc.response_source ?? null,
    responded_at: doc.responded_at ? doc.responded_at.toISOString() : null,
    responded_by: doc.responded_by_user_id ? { id: doc.responded_by_user_id.toString(), name: respondedByName ?? "Unknown" } : null,
  };
}

export interface OfferListRowDTO {
  id: string;
  public_id?: string;
  application_id: string;
  /** Opaque, URL-facing identifier for the owning Application — see ApplicationListRowDTO.public_id. */
  application_public_id?: string;
  candidate: { id: string; full_name: string; email: string };
  job: { id: string; title: string };
  title: string;
  status: OfferStatus;
  salary_amount: number | null;
  salary_currency: string | null;
  start_date: string | null;
  sent_at: string | null;
  updated_at: string;
}

/**
 * The /offers company-wide list row — joins in just enough candidate/job
 * context for that page's table, batched by the caller (see
 * offer.service.ts's listOffers), never resolved per-row. Deliberately
 * excludes internal_notes/candidate_message (not needed by the list view;
 * available on the full Offer via the Application Detail page instead).
 */
export function serializeOfferListRow(
  doc: OfferDoc,
  candidate: CandidateDoc,
  job: JobDoc,
  applicationPublicId?: string
): OfferListRowDTO {
  return {
    id: doc.id,
    public_id: doc.public_id ?? undefined,
    application_id: doc.application_id.toString(),
    application_public_id: applicationPublicId,
    candidate: { id: candidate.id, full_name: candidate.full_name, email: candidate.email },
    job: { id: job.id, title: job.title },
    title: doc.title,
    status: doc.status,
    salary_amount: doc.salary_amount ?? null,
    salary_currency: doc.salary_currency ?? null,
    start_date: doc.start_date ? doc.start_date.toISOString() : null,
    sent_at: doc.sent_at ? doc.sent_at.toISOString() : null,
    updated_at: doc.updated_at!.toISOString(),
  };
}
