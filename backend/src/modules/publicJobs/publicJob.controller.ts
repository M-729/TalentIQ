import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as publicJobService from "./publicJob.service";

export const getPublicJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = await publicJobService.getPublicJob(req.params.id!);
  res.status(200).json({ job });
});
