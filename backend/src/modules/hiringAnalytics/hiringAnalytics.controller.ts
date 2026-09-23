import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { getHiringAnalytics } from "./hiringAnalytics.service";
import type { GetHiringAnalyticsQuery } from "./hiringAnalytics.validation";

export const getHiringAnalyticsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as GetHiringAnalyticsQuery;
  const analytics = await getHiringAnalytics(req.auth!.companyId, { range: query.range, jobId: query.jobId });
  res.status(200).json(analytics);
});
