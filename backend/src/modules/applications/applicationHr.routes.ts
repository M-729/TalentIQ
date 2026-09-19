import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getApplicationDetailHandler, listApplicationsHandler } from "./applicationHr.controller";
import { applicationIdParamsSchema, listApplicationsQuerySchema } from "./applicationHr.validation";

// HR/Admin-only, authenticated Applications management — distinct from the
// public candidate submission route (mounted separately under
// /public/jobs, no auth) and from the AI screening routes nested under
// /:applicationId/screenings. No candidate/public access here.
export const applicationHrRouter = Router();

applicationHrRouter.use(requireAuth, requireRole("HR", "ADMIN"));

applicationHrRouter.get("/", validate({ query: listApplicationsQuerySchema }), listApplicationsHandler);
applicationHrRouter.get(
  "/:applicationId",
  validate({ params: applicationIdParamsSchema }),
  getApplicationDetailHandler
);
