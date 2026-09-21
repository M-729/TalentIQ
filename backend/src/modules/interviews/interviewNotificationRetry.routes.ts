import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { retryInterviewNotificationHandler } from "./interviewNotification.controller";
import { notificationIdParamsSchema, retryNotificationBodySchema } from "./interviewNotification.validation";

// Mounted at /api/v1/interview-notifications — a notification is
// addressed directly by its own id, not nested under an interviewId, so
// this is a separate router/prefix from interview.routes.ts (matching
// how googleCalendarOAuthRouter and userRouter are each their own
// top-level mount in app.ts).
export const interviewNotificationRetryRouter = Router();

interviewNotificationRetryRouter.use(requireAuth, requireRole("HR", "ADMIN"));

interviewNotificationRetryRouter.post(
  "/:notificationId/retry",
  validate({ params: notificationIdParamsSchema, body: retryNotificationBodySchema }),
  retryInterviewNotificationHandler
);
