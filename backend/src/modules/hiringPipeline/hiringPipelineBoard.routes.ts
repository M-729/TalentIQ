import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { bulkMoveApplicationsHandler, getHiringPipelineBoardHandler } from "./hiringPipelineBoard.controller";
import { bulkMoveApplicationsSchema, jobIdParamsSchema } from "./hiringPipelineBoard.validation";

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

// Bulk multi-candidate stage movement — see hiringPipelineBoard.service.ts's
// bulkMoveApplications for the transactional/all-or-nothing contract. Same
// HR/Admin-only gate as every other route on this router.
hiringPipelineBoardRouter.patch(
  "/bulk-move",
  validate({ params: jobIdParamsSchema, body: bulkMoveApplicationsSchema }),
  bulkMoveApplicationsHandler
);
