import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { setRefreshCookie } from "../auth/auth.controller";
import * as service from "./companyInvitationResponse.service";
import type { AcceptCompanyInvitationInput, LookupCompanyInvitationInput } from "./companyInvitationResponse.validation";

export const lookupCompanyInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token } = req.body as LookupCompanyInvitationInput;
  const dto = await service.lookupCompanyInvitation(token);
  res.status(200).json(dto);
});

// Always 200, whatever the outcome (accepted or not eligible) — the state
// is carried in the JSON body, never the HTTP status, so a public caller
// can never infer anything about WHY from status-code timing alone, same
// convention as offerResponse.controller.ts's respond handler.
export const acceptCompanyInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const { token, full_name, password } = req.body as AcceptCompanyInvitationInput;

  const result = await service.acceptCompanyInvitation(token, { fullName: full_name, password }, req.ip);

  if (result.outcome === "accepted") {
    setRefreshCookie(res, result.tokens.refreshToken, result.tokens.refreshTokenExpiresAt);
    res.status(200).json({ state: "accepted", accessToken: result.tokens.accessToken, user: result.user });
    return;
  }

  res.status(200).json(result.dto);
});
