import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  cancelInterviewHandler,
  completeInterviewHandler,
  createGoogleCalendarEventHandler,
  getInterviewHandler,
  listInterviewsForCompanyHandler,
  listInterviewsHandler,
  rescheduleInterviewHandler,
  scheduleInterviewHandler,
  syncGoogleCalendarEventHandler,
} from "./interview.controller";
import { listInterviewNotificationsHandler } from "./interviewNotification.controller";
import {
  listInterviewFeedbackHandler,
  saveOwnFeedbackDraftHandler,
  submitOwnFeedbackHandler,
} from "./interviewFeedback.controller";
import {
  applicationIdParamsSchema,
  cancelInterviewSchema,
  completeInterviewSchema,
  googleCalendarActionBodySchema,
  interviewIdParamsSchema,
  listInterviewsQuerySchema,
  rescheduleInterviewSchema,
  scheduleInterviewSchema,
} from "./interview.validation";
import { saveFeedbackDraftSchema, submitFeedbackSchema } from "./interviewFeedback.validation";

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

// Company-wide list for the /interviews page. Registered at the router's
// own root — never collides with "/:interviewId" below regardless of
// order (a request to the exact mount path only ever matches "/", one
// requiring a path segment only ever matches "/:interviewId").
interviewDetailRouter.get("/", validate({ query: listInterviewsQuerySchema }), listInterviewsForCompanyHandler);

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
interviewDetailRouter.patch(
  "/:interviewId/complete",
  validate({ params: interviewIdParamsSchema, body: completeInterviewSchema }),
  completeInterviewHandler
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

// Full candidate-notification history for this Interview — see
// interviewNotification.service.ts. Retry lives on its own top-level
// route (interviewNotificationRetry.routes.ts) since it addresses a
// notification directly by id, not nested under an interviewId.
interviewDetailRouter.get(
  "/:interviewId/notifications",
  validate({ params: interviewIdParamsSchema }),
  listInterviewNotificationsHandler
);

// Interview Feedback — only ever meaningful once the Interview is
// completed (see interviewFeedback.service.ts); who is reading/writing is
// always req.auth.userId, never a client-supplied interviewer id.
interviewDetailRouter.get(
  "/:interviewId/feedback",
  validate({ params: interviewIdParamsSchema }),
  listInterviewFeedbackHandler
);
interviewDetailRouter.put(
  "/:interviewId/feedback/me",
  validate({ params: interviewIdParamsSchema, body: saveFeedbackDraftSchema }),
  saveOwnFeedbackDraftHandler
);
interviewDetailRouter.post(
  "/:interviewId/feedback/me/submit",
  validate({ params: interviewIdParamsSchema, body: submitFeedbackSchema }),
  submitOwnFeedbackHandler
);
