import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getRejectionInfoHandler, rejectApplicationHandler, retryRejectionEmailHandler } from "./rejection.controller";
import { applicationIdParamsSchema, rejectApplicationSchema } from "./rejection.validation";

// Mounted at /api/v1/applications/:applicationId/reject — mergeParams is
// required because :applicationId is defined on the parent mount path in
// app.ts, not on any route declared in this router (same pattern as
// stageTransitionRouter/applicationAssessmentCreateRouter).
export const rejectionRouter = Router({ mergeParams: true });

// HR/Admin only — rejecting a candidate is always an explicit human
// decision, never something a Candidate or an unauthenticated caller can
// trigger.
rejectionRouter.use(requireAuth, requireRole("HR", "ADMIN"));

rejectionRouter.post("/", validate({ params: applicationIdParamsSchema, body: rejectApplicationSchema }), rejectApplicationHandler);
rejectionRouter.post("/retry", validate({ params: applicationIdParamsSchema }), retryRejectionEmailHandler);
rejectionRouter.get("/", validate({ params: applicationIdParamsSchema }), getRejectionInfoHandler);
