import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as hiringPipelineBoardService from "./hiringPipelineBoard.service";
import type { BulkMoveApplicationsInput } from "./hiringPipelineBoard.validation";

export const getHiringPipelineBoardHandler = asyncHandler(async (req: Request, res: Response) => {
  const board = await hiringPipelineBoardService.getHiringPipelineBoard(req.auth!.companyId, req.params.jobId!);
  res.status(200).json(board);
});

export const bulkMoveApplicationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const result = await hiringPipelineBoardService.bulkMoveApplications(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.jobId!,
    req.body as BulkMoveApplicationsInput
  );
  res.status(200).json(result);
});
