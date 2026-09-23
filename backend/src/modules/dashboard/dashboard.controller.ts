import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { getDashboard } from "./dashboard.service";

export const getDashboardHandler = asyncHandler(async (req: Request, res: Response) => {
  const dashboard = await getDashboard(req.auth!.companyId);
  res.status(200).json(dashboard);
});
