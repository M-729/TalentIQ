import { z } from "zod";
import { Types } from "mongoose";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const notificationIdParamsSchema = z.object({
  notificationId: objectIdString("notification id"),
});

// Retry accepts no business input at all — recipient/subject/body are
// always reconstructed from trusted persisted TalentIQ data, never from
// the request (see interviewNotification.service.ts's retryNotification).
// `.strict()` rejects any unexpected field outright, same pattern as
// googleCalendarActionBodySchema.
export const retryNotificationBodySchema = z.object({}).strict();
