import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { aiScreeningRateLimiter } from "../../middleware/rateLimit.middleware";
import { createScreeningHandler, getLatestScreeningHandler, getScreeningHistoryHandler } from "./screening.controller";
import { applicationIdParamsSchema, createScreeningBodySchema } from "./screening.validation";

// mergeParams: true is required because :applicationId is defined on the
// parent mount path in app.ts, not on any route declared in this router.
export const screeningRouter = Router({ mergeParams: true });

// HR and Admin only, matching job.routes.ts's own router-level
// requireAuth/requireRole placement rather than repeating it per route.
screeningRouter.use(requireAuth, requireRole("HR", "ADMIN"));

// Explicitly triggers a new (paid) AI screening — rate-limited per user.
// Only this route carries aiScreeningRateLimiter; the two read routes
// below intentionally do not.
screeningRouter.post(
  "/",
  aiScreeningRateLimiter,
  validate({ params: applicationIdParamsSchema, body: createScreeningBodySchema }),
  createScreeningHandler
);

// Registered before the bare "/" GET so it can never be shadowed by a
// future GET "/:screeningId"-style route.
screeningRouter.get("/latest", validate({ params: applicationIdParamsSchema }), getLatestScreeningHandler);

screeningRouter.get("/", validate({ params: applicationIdParamsSchema }), getScreeningHistoryHandler);
