import { z } from "zod";
import { publicIdPattern } from "../../utils/publicId";

// Public-id only (Phase 2 cutover — see this ticket's report): a raw Mongo
// ObjectId no longer resolves as an EmailNotification URL id.
const NOTIFICATION_PUBLIC_ID_PATTERN = publicIdPattern("notif");
const notificationIdentifierString = (label: string) =>
  z.string().refine((val) => NOTIFICATION_PUBLIC_ID_PATTERN.test(val), {
    message: `Invalid ${label}`,
  });

export const notificationIdParamsSchema = z.object({
  notificationId: notificationIdentifierString("notification id"),
});

// Retry accepts no business input at all — recipient/subject/body are
// always reconstructed from trusted persisted TalentIQ data, never from
// the request (see interviewNotification.service.ts's retryNotification).
// `.strict()` rejects any unexpected field outright, same pattern as
// googleCalendarActionBodySchema.
export const retryNotificationBodySchema = z.object({}).strict();
