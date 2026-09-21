import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as interviewService from "./interview.service";
import { serializeInterview, serializeInterviews } from "./interview.serializer";
import type { CancelInterviewInput, RescheduleInterviewInput, ScheduleInterviewInput } from "./interview.validation";

export const scheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewService.scheduleInterview(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.applicationId!,
    req.body as ScheduleInterviewInput
  );
  const userMap = await interviewService.batchUserLookup([interview]);
  res.status(201).json({ interview: serializeInterview(interview, userMap) });
});

export const listInterviewsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { interviews, userMap } = await interviewService.listInterviewsForApplication(
    req.params.applicationId!,
    req.auth!.companyId
  );
  res.status(200).json({ interviews: serializeInterviews(interviews, userMap) });
});

export const getInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const { interview, userMap } = await interviewService.getInterviewDetail(req.params.interviewId!, req.auth!.companyId);
  res.status(200).json({ interview: serializeInterview(interview, userMap) });
});

export const rescheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewService.rescheduleInterview(
    req.auth!.companyId,
    req.params.interviewId!,
    req.body as RescheduleInterviewInput
  );
  const userMap = await interviewService.batchUserLookup([interview]);
  res.status(200).json({ interview: serializeInterview(interview, userMap) });
});

export const cancelInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewService.cancelInterview(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.interviewId!,
    req.body as CancelInterviewInput
  );
  const userMap = await interviewService.batchUserLookup([interview]);
  res.status(200).json({ interview: serializeInterview(interview, userMap) });
});
