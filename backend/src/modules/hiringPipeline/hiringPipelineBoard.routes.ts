import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getHiringPipelineBoardHandler } from "./hiringPipelineBoard.controller";
import { jobIdParamsSchema } from "./hiringPipelineBoard.validation";

// mergeParams: true is required because :jobId is defined on the parent
// mount path in app.ts, not on any route declared in this router.
export const hiringPipelineBoardRouter = Router({ mergeParams: true });

// HR/Admin only, same as every other pipeline-management route — no
// Candidate or public access. A separate read model from
// hiringStep.routes.ts's /jobs/:jobId/hiring-steps (which configures
// stages); this endpoint returns Applications grouped by stage for the
// recruiter board.
hiringPipelineBoardRouter.use(requireAuth, requireRole("HR", "ADMIN"));

hiringPipelineBoardRouter.get("/", validate({ params: jobIdParamsSchema }), getHiringPipelineBoardHandler);
