import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as interviewNotificationService from "./interviewNotification.service";
import { serializeInterviewNotification, serializeInterviewNotifications } from "./interviewNotification.serializer";

export const listInterviewNotificationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const notifications = await interviewNotificationService.listNotificationsForInterview(
    req.params.interviewId!,
    req.auth!.companyId
  );
  res.status(200).json({ notifications: serializeInterviewNotifications(notifications) });
});

// Company-scoped via the notification's own company_id; only a "failed"
// notification is retryable (see retryNotification's own doc comment).
export const retryInterviewNotificationHandler = asyncHandler(async (req: Request, res: Response) => {
  const notification = await interviewNotificationService.retryNotification(req.params.notificationId!, req.auth!.companyId);
  res.status(200).json({ notification: serializeInterviewNotification(notification) });
});
