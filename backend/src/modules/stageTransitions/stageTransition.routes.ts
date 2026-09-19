import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getStageHistoryHandler, moveApplicationStageHandler } from "./stageTransition.controller";
import { applicationIdParamsSchema, moveApplicationStageSchema } from "./stageTransition.validation";

// mergeParams: true is required because :applicationId is defined on the
// parent mount path in app.ts, not on any route declared in this router.
export const stageTransitionRouter = Router({ mergeParams: true });

// HR/Admin only — moving an applicant through the pipeline is always an
// explicit human decision, never something a Candidate or an
// unauthenticated caller can trigger.
stageTransitionRouter.use(requireAuth, requireRole("HR", "ADMIN"));

stageTransitionRouter.patch(
  "/hiring-step",
  validate({ params: applicationIdParamsSchema, body: moveApplicationStageSchema }),
  moveApplicationStageHandler
);

stageTransitionRouter.get(
  "/stage-history",
  validate({ params: applicationIdParamsSchema }),
  getStageHistoryHandler
);
