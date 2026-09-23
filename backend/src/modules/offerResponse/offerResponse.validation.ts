import { z } from "zod";

// A raw response token is a 64-char hex string (crypto.randomBytes(32) —
// see offerResponseToken.service.ts) — bounded generously above that so a
// garbage/oversized value is rejected by validation before ever reaching
// a database hash+lookup, without hard-coding the exact expected length
// (defense in depth, not a functional requirement).
const tokenSchema = z.string().trim().min(1, "Token is required").max(512, "Invalid token");

// `.strict()` — this is a fully public, unauthenticated endpoint; nothing
// beyond the opaque token itself is ever trusted from the client (see
// offerResponse.service.ts's lookupOfferResponse).
export const lookupOfferResponseSchema = z.object({ token: tokenSchema }).strict();
export type LookupOfferResponseInput = z.infer<typeof lookupOfferResponseSchema>;

// Wire format matches Offer.model.ts's own OFFER_STATUSES vocabulary
// ("accepted"/"declined") directly — the shorter "accept"/"decline" used
// in the email URL fragment is a frontend-only concept (which button/copy
// to show), translated to this exact wire value before the respond call
// is made (see OfferResponsePage.tsx), so the backend never needs its own
// separate vocabulary to keep in sync with Offer.status.
export const respondOfferResponseSchema = z
  .object({
    token: tokenSchema,
    decision: z.enum(["accepted", "declined"]),
  })
  .strict();
export type RespondOfferResponseInput = z.infer<typeof respondOfferResponseSchema>;
