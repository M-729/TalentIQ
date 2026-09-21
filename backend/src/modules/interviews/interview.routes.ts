import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  cancelInterviewHandler,
  createGoogleCalendarEventHandler,
  getInterviewHandler,
  listInterviewsHandler,
  rescheduleInterviewHandler,
  scheduleInterviewHandler,
  syncGoogleCalendarEventHandler,
} from "./interview.controller";
import {
  applicationIdParamsSchema,
  cancelInterviewSchema,
  googleCalendarActionBodySchema,
  interviewIdParamsSchema,
  rescheduleInterviewSchema,
  scheduleInterviewSchema,
} from "./interview.validation";

// mergeParams: true is required because :applicationId is defined on the
// parent mount path in app.ts, not on any route declared in this router.
// Mounted at /api/v1/applications/:applicationId/interviews.
export const interviewRouter = Router({ mergeParams: true });

interviewRouter.use(requireAuth, requireRole("HR", "ADMIN"));

interviewRouter.post(
  "/",
  validate({ params: applicationIdParamsSchema, body: scheduleInterviewSchema }),
  scheduleInterviewHandler
);
interviewRouter.get("/", validate({ params: applicationIdParamsSchema }), listInterviewsHandler);

// A separate router — Interview detail/reschedule/cancel are addressed
// directly by interviewId, not nested under an applicationId, so this is
// mounted at a different prefix (/api/v1/interviews) in app.ts.
export const interviewDetailRouter = Router();

interviewDetailRouter.use(requireAuth, requireRole("HR", "ADMIN"));

interviewDetailRouter.get("/:interviewId", validate({ params: interviewIdParamsSchema }), getInterviewHandler);
interviewDetailRouter.patch(
  "/:interviewId/reschedule",
  validate({ params: interviewIdParamsSchema, body: rescheduleInterviewSchema }),
  rescheduleInterviewHandler
);
interviewDetailRouter.patch(
  "/:interviewId/cancel",
  validate({ params: interviewIdParamsSchema, body: cancelInterviewSchema }),
  cancelInterviewHandler
);

// "Create/synchronize this scheduled Interview into my connected Google
// Calendar" — never creates a second Interview, only the ONE Calendar
// event for an existing one (see interviewCalendarSync.service.ts).
interviewDetailRouter.post(
  "/:interviewId/google-calendar",
  validate({ params: interviewIdParamsSchema, body: googleCalendarActionBodySchema }),
  createGoogleCalendarEventHandler
);

// The one explicit retry/reconciliation endpoint.
interviewDetailRouter.post(
  "/:interviewId/google-calendar/sync",
  validate({ params: interviewIdParamsSchema, body: googleCalendarActionBodySchema }),
  syncGoogleCalendarEventHandler
);
