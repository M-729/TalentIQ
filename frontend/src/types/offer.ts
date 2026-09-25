// Mirrors backend/src/modules/offers/offer.serializer.ts exactly.
export const OFFER_STATUSES = ["draft", "sent", "accepted", "declined", "withdrawn"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

export const OFFER_CURRENCIES = ["USD", "EUR", "GBP", "LBP"] as const;
export type OfferCurrency = (typeof OFFER_CURRENCIES)[number];

export const OFFER_RESPONSE_SOURCES = ["candidate", "hr"] as const;
export type OfferResponseSource = (typeof OFFER_RESPONSE_SOURCES)[number];

export interface Offer {
  id: string;
  // Opaque, URL-safe identifier — kept in sync with every other migrated
  // resource; Offer has no dedicated detail route yet.
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
  internal_notes: string | null;
  created_at: string;
  updated_at: string;
  sent_at: string | null;
  accepted_at: string | null;
  declined_at: string | null;
  withdrawn_at: string | null;
  /** "candidate" (via the public response link) or "hr" (manual fallback) — null until a response is recorded. */
  response_source: OfferResponseSource | null;
  responded_at: string | null;
  /** Only ever set for response_source === "hr". */
  responded_by: { id: string; name: string } | null;
}

export type OfferEmailStatus = "pending" | "sent" | "failed";

export interface OfferNotification {
  id: string;
  public_id?: string;
  status: OfferEmailStatus;
  subject: string;
  recipient_email: string;
  attempted_at: string | null;
  sent_at: string | null;
  failure_code: string | null;
  attempt_count: number;
  created_at: string;
}

export interface CreateOfferInput {
  title: string;
  salary_amount?: number | null;
  salary_currency?: OfferCurrency | null;
  employment_type?: string | null;
  start_date?: string | null;
  expires_at?: string | null;
  candidate_message?: string | null;
  internal_notes?: string | null;
}

export type UpdateOfferInput = Partial<CreateOfferInput>;

export interface OfferListRow {
  id: string;
  public_id?: string;
  application_id: string;
  // Opaque, URL-safe identifier for the owning Application — see
  // types/application.ts's ApplicationListRow.public_id.
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

export interface ListOffersFilters {
  jobId?: string;
  status?: OfferStatus;
  search?: string;
  page: number;
  limit: number;
}
