import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as screeningService from "./screening.service";
import { serializeScreening } from "./screening.serializer";

export const createScreeningHandler = asyncHandler(async (req: Request, res: Response) => {
  const screening = await screeningService.createScreening(req.params.applicationId!, req.auth!.companyId);
  res.status(201).json({ screening: serializeScreening(screening) });
});

export const getLatestScreeningHandler = asyncHandler(async (req: Request, res: Response) => {
  const { screening, status } = await screeningService.getLatestScreening(req.params.applicationId!, req.auth!.companyId);
  res.status(200).json({ screening: screening ? serializeScreening(screening) : null, status });
});

export const getScreeningHistoryHandler = asyncHandler(async (req: Request, res: Response) => {
  const screenings = await screeningService.getScreeningHistory(req.params.applicationId!, req.auth!.companyId);
  res.status(200).json({ screenings: screenings.map(serializeScreening) });
});
