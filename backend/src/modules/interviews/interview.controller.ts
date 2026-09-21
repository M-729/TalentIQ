import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as interviewService from "./interview.service";
import * as interviewCalendarSync from "./interviewCalendarSync.service";
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
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus(interviews);
  res.status(200).json({ interviews: serializeInterviews(interviews, userMap, ownerConnectedMap) });
});

export const getInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const { interview, userMap } = await interviewService.getInterviewDetail(req.params.interviewId!, req.auth!.companyId);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  res.status(200).json({ interview: serializeInterview(interview, userMap, ownerConnectedMap) });
});

/**
 * Reschedule stays authoritative locally regardless of Google: the core
 * TalentIQ update (interviewService.rescheduleInterview) is the ONLY
 * thing that can make this handler fail (400/404/409) — a linked
 * Calendar event, if any, is then best-effort synced afterward and can
 * never roll back or fail the already-committed local reschedule (see
 * interviewCalendarSync.service.ts's bestEffortSyncAfterReschedule,
 * which never throws).
 */
export const rescheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const rescheduled = await interviewService.rescheduleInterview(
    req.auth!.companyId,
    req.params.interviewId!,
    req.body as RescheduleInterviewInput
  );
  const interview = await interviewCalendarSync.bestEffortSyncAfterReschedule(rescheduled);
  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  res.status(200).json({ interview: serializeInterview(interview, userMap, ownerConnectedMap) });
});

/** Same "local action always wins, Google sync is best-effort afterward" contract as reschedule above. */
export const cancelInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const cancelled = await interviewService.cancelInterview(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.interviewId!,
    req.body as CancelInterviewInput
  );
  const interview = await interviewCalendarSync.bestEffortSyncAfterCancel(cancelled);
  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  res.status(200).json({ interview: serializeInterview(interview, userMap, ownerConnectedMap) });
});

// Explicit user-initiated actions (unlike the best-effort reschedule/
// cancel sync above) — a Google failure here IS the request's failure,
// surfaced as a real error status, since the whole point of calling this
// endpoint is "tell me whether this worked".
export const createGoogleCalendarEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewCalendarSync.createGoogleCalendarEvent(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.interviewId!
  );
  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  res.status(201).json({ interview: serializeInterview(interview, userMap, ownerConnectedMap) });
});

export const syncGoogleCalendarEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewCalendarSync.syncGoogleCalendarEvent(req.auth!.companyId, req.params.interviewId!);
  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  res.status(200).json({ interview: serializeInterview(interview, userMap, ownerConnectedMap) });
});
