import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as jobService from "./job.service";
import type { CreateJobInput, ListJobsQuery, UpdateJobInput } from "./job.validation";

export const createJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.createJob(req.auth!.companyId, req.auth!.userId, req.body as CreateJobInput);
  res.status(201).json({ job });
});

export const listJobsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { status } = req.query as unknown as ListJobsQuery;
  const jobs = await jobService.listJobs(req.auth!.companyId, status);
  res.status(200).json({ jobs });
});

export const getJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.getJob(req.auth!.companyId, req.params.id!);
  res.status(200).json({ job });
});

export const updateJobHandler = asyncHandler(async (req: Request, res: Response) => {
  const job = await jobService.updateJob(req.auth!.companyId, req.params.id!, req.body as UpdateJobInput);
  res.status(200).json({ job });
});

export const deleteJobHandler = asyncHandler(async (req: Request, res: Response) => {
  await jobService.deleteJob(req.auth!.companyId, req.params.id!);
  res.status(204).send();
});
