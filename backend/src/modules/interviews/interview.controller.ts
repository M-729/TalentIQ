import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as interviewService from "./interview.service";
import * as interviewCalendarSync from "./interviewCalendarSync.service";
import * as interviewNotificationService from "./interviewNotification.service";
import { serializeInterview, serializeInterviewDetail, serializeInterviewListRows, serializeInterviews } from "./interview.serializer";
import type {
  CancelInterviewInput,
  ListInterviewsQuery,
  RescheduleInterviewInput,
  ScheduleInterviewInput,
} from "./interview.validation";

/**
 * Company-wide list for the /interviews page (distinct from
 * listInterviewsHandler below, which is scoped to one Application). Same
 * "batch the owner-connection map once, pass it into the serializer"
 * pattern as every other Interview list/detail handler.
 */
export const listInterviewsForCompanyHandler = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListInterviewsQuery;
  const { interviews, total, userMap, candidateByApplicationId, jobById } = await interviewService.listInterviewsForCompany(
    req.auth!.companyId,
    { status: query.status, jobId: query.jobId, when: query.when, page: query.page, limit: query.limit }
  );
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus(interviews);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus(interviews.map((i) => i.id));

  res.status(200).json({
    interviews: serializeInterviewListRows(interviews, {
      userMap,
      candidateByApplicationId,
      jobById,
      ownerConnectedMap,
      latestNotificationMap,
    }),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    },
  });
});

/**
 * After the local schedule succeeds, a candidate "Interview scheduled"
 * email is attempted — best-effort (see
 * interviewNotificationService.sendInterviewScheduledNotification, which
 * never throws). A delivery failure here never turns this into a failed
 * request; the response always reflects the successfully scheduled
 * Interview, with latest_notification showing whatever the attempt's
 * outcome was.
 */
export const scheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewService.scheduleInterview(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.applicationId!,
    req.body as ScheduleInterviewInput
  );
  await interviewNotificationService.sendInterviewScheduledNotification(interview, req.auth!.userId);

  const userMap = await interviewService.batchUserLookup([interview]);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus([interview.id]);
  res.status(201).json({ interview: serializeInterview(interview, userMap, new Map(), latestNotificationMap) });
});

export const listInterviewsHandler = asyncHandler(async (req: Request, res: Response) => {
  const { interviews, userMap } = await interviewService.listInterviewsForApplication(
    req.params.applicationId!,
    req.auth!.companyId
  );
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus(interviews);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus(interviews.map((i) => i.id));
  res.status(200).json({ interviews: serializeInterviews(interviews, userMap, ownerConnectedMap, latestNotificationMap) });
});

// The one endpoint that names candidate/job (see
// interview.serializer.ts's serializeInterviewDetail doc comment) — this
// is the only Interview route reachable without the caller already being
// on that Application's own detail page (e.g. from the company-wide
// /interviews list).
export const getInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const { interview, userMap, candidate, job } = await interviewService.getInterviewDetail(
    req.params.interviewId!,
    req.auth!.companyId
  );
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus([interview.id]);
  res
    .status(200)
    .json({ interview: serializeInterviewDetail(interview, userMap, candidate, job, ownerConnectedMap, latestNotificationMap) });
});

/**
 * Reschedule stays authoritative locally regardless of Google or email:
 * the core TalentIQ update (interviewService.rescheduleInterview) is the
 * ONLY thing that can make this handler fail (400/404/409). A candidate
 * "Interview rescheduled" email is then attempted (best-effort, never
 * throws), followed by the existing best-effort Google Calendar sync —
 * matching this ticket's explicit ordering (local mutation -> candidate
 * email attempt -> Google sync, all independent of one another). Neither
 * email nor Calendar sync can roll back or fail the already-committed
 * local reschedule.
 *
 * When rescheduleInterview reports `mutated: false` (a duplicate/
 * identical request — see its own doc comment), NEITHER the candidate
 * email NOR the Google Calendar sync is even attempted: nothing actually
 * changed, so there is nothing new to notify about or sync. The response
 * is still a clean 200 with the current Interview.
 */
export const rescheduleInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const { interview: rescheduled, mutated } = await interviewService.rescheduleInterview(
    req.auth!.companyId,
    req.params.interviewId!,
    req.body as RescheduleInterviewInput
  );

  let interview = rescheduled;
  if (mutated) {
    await interviewNotificationService.sendInterviewRescheduledNotification(rescheduled, req.auth!.userId);
    interview = await interviewCalendarSync.bestEffortSyncAfterReschedule(rescheduled);
  }

  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus([interview.id]);
  res
    .status(200)
    .json({ interview: serializeInterview(interview, userMap, ownerConnectedMap, latestNotificationMap) });
});

/** Same "local action always wins, email/Google sync are both best-effort afterward" contract as reschedule above. */
export const cancelInterviewHandler = asyncHandler(async (req: Request, res: Response) => {
  const cancelled = await interviewService.cancelInterview(
    req.auth!.companyId,
    req.auth!.userId,
    req.params.interviewId!,
    req.body as CancelInterviewInput
  );
  await interviewNotificationService.sendInterviewCancelledNotification(cancelled, req.auth!.userId);

  const interview = await interviewCalendarSync.bestEffortSyncAfterCancel(cancelled);
  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus([interview.id]);
  res
    .status(200)
    .json({ interview: serializeInterview(interview, userMap, ownerConnectedMap, latestNotificationMap) });
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
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus([interview.id]);
  res
    .status(201)
    .json({ interview: serializeInterview(interview, userMap, ownerConnectedMap, latestNotificationMap) });
});

export const syncGoogleCalendarEventHandler = asyncHandler(async (req: Request, res: Response) => {
  const interview = await interviewCalendarSync.syncGoogleCalendarEvent(req.auth!.companyId, req.params.interviewId!);
  const userMap = await interviewService.batchUserLookup([interview]);
  const ownerConnectedMap = await interviewCalendarSync.batchOwnerConnectionStatus([interview]);
  const latestNotificationMap = await interviewNotificationService.batchLatestNotificationStatus([interview.id]);
  res
    .status(200)
    .json({ interview: serializeInterview(interview, userMap, ownerConnectedMap, latestNotificationMap) });
});
