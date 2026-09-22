import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createAssessmentHandler,
  getAssessmentForApplicationHandler,
  listAssessmentHistoryHandler,
  listAssessmentNotificationsHandler,
  listAssessmentsHandler,
  recordAssessmentResultHandler,
  retryAssessmentNotificationHandler,
  sendAssessmentInvitationHandler,
  updateAssessmentLinkHandler,
} from "./applicationAssessment.controller";
import {
  applicationIdParamsSchema,
  assessmentIdParamsSchema,
  createAssessmentSchema,
  listAssessmentsQuerySchema,
  notificationIdParamsSchema,
  recordAssessmentResultSchema,
  sendAssessmentBodySchema,
  updateAssessmentLinkSchema,
} from "./applicationAssessment.validation";

// Mounted at /api/v1/applications/:applicationId/assessment — mergeParams
// is required because :applicationId is defined on the parent mount path
// in app.ts, not on any route declared in this router (same pattern as
// stageTransitionRouter/screeningRouter).
export const applicationAssessmentCreateRouter = Router({ mergeParams: true });
applicationAssessmentCreateRouter.use(requireAuth, requireRole("HR", "ADMIN"));

applicationAssessmentCreateRouter.post(
  "/",
  validate({ params: applicationIdParamsSchema, body: createAssessmentSchema }),
  createAssessmentHandler
);
applicationAssessmentCreateRouter.get("/", validate({ params: applicationIdParamsSchema }), getAssessmentForApplicationHandler);
// The smallest addition needed for full Application-level assessment
// history (see this ticket) — a sibling route on the SAME router/mount,
// never a new top-level app.ts mount.
applicationAssessmentCreateRouter.get(
  "/history",
  validate({ params: applicationIdParamsSchema }),
  listAssessmentHistoryHandler
);

// Mounted at /api/v1/application-assessments — an assessment is addressed
// directly by its own id, matching interviewNotificationRetryRouter's own
// "addressed by id, not nested" precedent for the same reason (these
// actions don't need the applicationId in the URL once you have the
// assessment's own id).
export const applicationAssessmentRouter = Router();
applicationAssessmentRouter.use(requireAuth, requireRole("HR", "ADMIN"));

applicationAssessmentRouter.get("/", validate({ query: listAssessmentsQuerySchema }), listAssessmentsHandler);

applicationAssessmentRouter.patch(
  "/:assessmentId",
  validate({ params: assessmentIdParamsSchema, body: updateAssessmentLinkSchema }),
  updateAssessmentLinkHandler
);
applicationAssessmentRouter.patch(
  "/:assessmentId/result",
  validate({ params: assessmentIdParamsSchema, body: recordAssessmentResultSchema }),
  recordAssessmentResultHandler
);
applicationAssessmentRouter.post(
  "/:assessmentId/send",
  validate({ params: assessmentIdParamsSchema, body: sendAssessmentBodySchema }),
  sendAssessmentInvitationHandler
);
applicationAssessmentRouter.get(
  "/:assessmentId/notifications",
  validate({ params: assessmentIdParamsSchema }),
  listAssessmentNotificationsHandler
);
applicationAssessmentRouter.post(
  "/:assessmentId/notifications/:notificationId/retry",
  validate({ params: notificationIdParamsSchema, body: sendAssessmentBodySchema }),
  retryAssessmentNotificationHandler
);
