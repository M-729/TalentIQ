import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as publicJobService from "./publicJob.service";
import type { ListPublicJobsQuery } from "./publicJob.validation";

export const getPublicJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = await publicJobService.getPublicJob(req.params.id!);
  res.status(200).json({ job });
});

export const listPublicJobsHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListPublicJobsQuery;
  const { jobs, total } = await publicJobService.listPublicJobs({
    search: query.search,
    location: query.location,
    employmentType: query.employmentType,
    department: query.department,
    page: query.page,
    limit: query.limit,
  });

  res.status(200).json({
    jobs,
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});
