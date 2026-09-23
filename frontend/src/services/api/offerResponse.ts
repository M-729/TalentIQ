import { apiClient } from "@/services/api/client";
import type { OfferResponseResult } from "@/types/offerResponse";

// Public, unauthenticated — the candidate has no TalentIQ account. Both
// calls are POST (never GET), matching the backend's own "keep the opaque
// token out of URL paths/logs" design (see offerResponse.routes.ts) — the
// token only ever travels in the request body, read here from the page's
// own URL fragment, never forwarded as a query string.

// Read-only — opening the email link/loading this page must cause ZERO
// Offer mutation (see offerResponse.service.ts's lookupOfferResponse doc
// comment). Never call this from anything but a page load/lookup.
export function lookupOfferResponse(token: string): Promise<OfferResponseResult> {
  return apiClient.post<OfferResponseResult>("/public/offer-response/lookup", { token });
}

// The ONLY call in this flow that may mutate an Offer — only ever fired
// from an explicit "Confirm acceptance"/"Confirm decline" click.
export function respondToOfferResponse(token: string, decision: "accepted" | "declined"): Promise<OfferResponseResult> {
  return apiClient.post<OfferResponseResult>("/public/offer-response/respond", { token, decision });
}
