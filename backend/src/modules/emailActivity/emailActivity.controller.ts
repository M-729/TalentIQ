import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { listEmailActivity } from "./emailActivity.service";
import type { ListEmailActivityQuery } from "./emailActivity.validation";

export const listEmailActivityHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListEmailActivityQuery;
  const result = await listEmailActivity(req.auth!.companyId, query);
  res.status(200).json(result);
});
