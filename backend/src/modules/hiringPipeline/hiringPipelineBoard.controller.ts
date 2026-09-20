import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as hiringPipelineBoardService from "./hiringPipelineBoard.service";

export const getHiringPipelineBoardHandler = asyncHandler(async (req: Request, res: Response) => {
  const board = await hiringPipelineBoardService.getHiringPipelineBoard(req.auth!.companyId, req.params.jobId!);
  res.status(200).json(board);
});
