import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as applicationHrService from "./applicationHr.service";
import type { ListApplicationsQuery } from "./applicationHr.validation";

export const listApplicationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListApplicationsQuery;
  const { applications, total } = await applicationHrService.listApplications(req.auth!.companyId, {
    status: query.status,
    jobId: query.jobId,
    search: query.search,
    page: query.page,
    limit: query.limit,
  });

  res.status(200).json({
    applications,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});

export const getApplicationDetailHandler = asyncHandler(async (req: Request, res: Response) => {
  const application = await applicationHrService.getApplicationDetail(req.params.applicationId!, req.auth!.companyId);
  res.status(200).json({ application });
});
