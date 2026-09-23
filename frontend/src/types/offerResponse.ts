// Mirrors backend/src/modules/offerResponse/offerResponse.serializer.ts
// exactly. "invalid" omits every field below response_state — the backend
// never sends offer details alongside it (see that serializer's own doc
// comment on why).
export const OFFER_RESPONSE_STATES = ["awaiting_response", "accepted", "declined", "withdrawn", "expired", "invalid"] as const;
export type OfferResponseState = (typeof OFFER_RESPONSE_STATES)[number];

export interface OfferResponseResult {
  response_state: OfferResponseState;
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

// The frontend-only "intent" read from the email link's URL fragment
// (#token=...&decision=accept|decline) — translated to the backend's own
// "accepted"/"declined" wire vocabulary only at the moment the actual
// respond call is made (see services/api/offerResponse.ts).
export type OfferResponseIntent = "accept" | "decline";
