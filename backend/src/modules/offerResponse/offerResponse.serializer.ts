import type { OfferDoc } from "../../models/Offer.model";

// Covers every state Part 20 of this ticket enumerates: valid+sent
// ("awaiting_response"), valid+accepted, valid+declined, withdrawn,
// expired, invalid token. "Already used/responded" is deliberately NOT a
// separate state — an already-used token pointing at an Offer that has
// since been accepted/declined simply reports that SAME "accepted"/
// "declined" state (see offerResponse.service.ts): the OFFER's live
// status is always what's shown, regardless of which token (or how many
// times it's been opened) was used to look it up.
export const OFFER_RESPONSE_STATES = ["awaiting_response", "accepted", "declined", "withdrawn", "expired", "invalid"] as const;
export type OfferResponseState = (typeof OFFER_RESPONSE_STATES)[number];

export interface OfferResponseDTO {
  response_state: OfferResponseState;
  // Every field below is omitted entirely (not just null) for
  // response_state "invalid" — an invalid/unresolvable token must never
  // leak that ANY offer exists, let alone its details (see this ticket's
  // explicit Part 17 "must not reveal whether arbitrary Offer Mongo IDs
  // exist" rule). Deliberately excludes company_id/candidate_id/
  // application_id/internal_notes/AI screening/interview feedback/
  // assessment data/audit fields — none of those are read from anywhere
  // near this module, so there is nothing here to leak by omission.
  company_name?: string;
  job_title?: string;
  offer_title?: string;
  salary_amount?: number | null;
  salary_currency?: string | null;
  employment_type?: string | null;
  start_date?: string | null;
  expires_at?: string | null;
  candidate_message?: string | null;
}

export interface OfferPublicDetails {
  companyName: string;
  jobTitle: string;
  offer: OfferDoc;
}

/**
 * Builds the safe, candidate-facing detail fields shared by every
 * non-invalid response_state — a single place so lookup and respond can
 * never drift on what's considered safe to return.
 */
export function serializeOfferPublicDetails(details: OfferPublicDetails): Omit<OfferResponseDTO, "response_state"> {
  const { offer } = details;
  return {
    company_name: details.companyName,
    job_title: details.jobTitle,
    offer_title: offer.title,
    salary_amount: offer.salary_amount ?? null,
    salary_currency: offer.salary_currency ?? null,
    employment_type: offer.employment_type ?? null,
    start_date: offer.start_date ? offer.start_date.toISOString() : null,
    expires_at: offer.expires_at ? offer.expires_at.toISOString() : null,
    candidate_message: offer.candidate_message ?? null,
  };
}
