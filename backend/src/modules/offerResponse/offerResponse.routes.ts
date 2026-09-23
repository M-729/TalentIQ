import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { offerResponseLookupRateLimiter, offerResponseRespondRateLimiter } from "../../middleware/rateLimit.middleware";
import { lookupOfferResponseHandler, respondOfferResponseHandler } from "./offerResponse.controller";
import { lookupOfferResponseSchema, respondOfferResponseSchema } from "./offerResponse.validation";

export const offerResponseRouter = Router();

// Deliberately no requireAuth/requireRole on this whole router — the
// candidate has no TalentIQ account, so it must stay reachable without a
// session. The opaque token itself is the only authorization factor (see
// offerResponse.service.ts). Both routes are POST, including the
// read-only lookup — this keeps the opaque token out of the request path/
// query string (and therefore out of server access logs) entirely; it
// only ever travels in the request body (see this ticket's explicit Part
// 4 "using POST for lookup keeps the opaque token out of backend URL
// paths/logs" rule).
offerResponseRouter.post("/lookup", offerResponseLookupRateLimiter, validate({ body: lookupOfferResponseSchema }), lookupOfferResponseHandler);
offerResponseRouter.post("/respond", offerResponseRespondRateLimiter, validate({ body: respondOfferResponseSchema }), respondOfferResponseHandler);
