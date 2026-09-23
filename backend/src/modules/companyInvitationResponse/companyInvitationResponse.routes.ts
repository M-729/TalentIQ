import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { companyInvitationAcceptRateLimiter, companyInvitationLookupRateLimiter } from "../../middleware/rateLimit.middleware";
import { acceptCompanyInvitationSchema, lookupCompanyInvitationSchema } from "./companyInvitationResponse.validation";
import { acceptCompanyInvitationHandler, lookupCompanyInvitationHandler } from "./companyInvitationResponse.controller";

// Mounted at /api/v1/public/company-invitations. Deliberately no
// requireAuth anywhere here — the invitee has no TalentIQ account yet.
// Both POST (never GET) to keep the opaque token out of URL
// paths/query strings/logs — see this ticket's explicit Part 4-equivalent
// rule, same convention as offerResponse.routes.ts.
export const companyInvitationResponseRouter = Router();

companyInvitationResponseRouter.post(
  "/lookup",
  companyInvitationLookupRateLimiter,
  validate({ body: lookupCompanyInvitationSchema }),
  lookupCompanyInvitationHandler
);
companyInvitationResponseRouter.post(
  "/accept",
  companyInvitationAcceptRateLimiter,
  validate({ body: acceptCompanyInvitationSchema }),
  acceptCompanyInvitationHandler
);
