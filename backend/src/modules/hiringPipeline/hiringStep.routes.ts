import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createHiringStepHandler,
  deleteHiringStepHandler,
  listHiringStepsHandler,
  reorderHiringStepsHandler,
  updateHiringStepHandler,
} from "./hiringStep.controller";
import {
  createHiringStepSchema,
  jobIdParamsSchema,
  reorderHiringStepsSchema,
  stepParamsSchema,
  updateHiringStepSchema,
} from "./hiringStep.validation";

// mergeParams: true is required because :jobId is defined on the parent
// mount path in app.ts, not on any route declared in this router.
export const hiringStepRouter = Router({ mergeParams: true });

hiringStepRouter.use(requireAuth, requireRole("HR", "ADMIN"));

hiringStepRouter.get("/", validate({ params: jobIdParamsSchema }), listHiringStepsHandler);
hiringStepRouter.post("/", validate({ params: jobIdParamsSchema, body: createHiringStepSchema }), createHiringStepHandler);

// Registered before "/:stepId" so the literal "reorder" segment is never
// swallowed by the :stepId param route.
hiringStepRouter.patch(
  "/reorder",
  validate({ params: jobIdParamsSchema, body: reorderHiringStepsSchema }),
  reorderHiringStepsHandler
);

hiringStepRouter.patch(
  "/:stepId",
  validate({ params: stepParamsSchema, body: updateHiringStepSchema }),
  updateHiringStepHandler
);
hiringStepRouter.delete("/:stepId", validate({ params: stepParamsSchema }), deleteHiringStepHandler);
