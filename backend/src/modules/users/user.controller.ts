import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { listCompanyInterviewerCandidates } from "./user.service";

export const listInterviewerCandidatesHandler = asyncHandler(async (req: Request, res: Response) => {
  const users = await listCompanyInterviewerCandidates(req.auth!.companyId);
  res.status(200).json({ users });
});
