import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as offerResponseService from "./offerResponse.service";
import type { LookupOfferResponseInput, RespondOfferResponseInput } from "./offerResponse.validation";

// Read-only — see offerResponse.service.ts's lookupOfferResponse doc
// comment for the explicit "zero mutation" guarantee this relies on.
export const lookupOfferResponseHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as LookupOfferResponseInput;
  const result = await offerResponseService.lookupOfferResponse(token);
  res.status(200).json(result);
});

// The ONLY endpoint in this whole flow that may mutate an Offer.
export const respondOfferResponseHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token, decision } = req.body as RespondOfferResponseInput;
  const result = await offerResponseService.respondToOfferResponse(token, decision);
  res.status(200).json(result);
});
