import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { getHiringAnalyticsQuerySchema } from "./hiringAnalytics.validation";
import { getHiringAnalyticsHandler } from "./hiringAnalytics.controller";

// Mounted at /api/v1/hiring-analytics. HR and ADMIN both.
export const hiringAnalyticsRouter = Router();

hiringAnalyticsRouter.use(requireAuth, requireRole("HR", "ADMIN"));
hiringAnalyticsRouter.get("/", validate({ query: getHiringAnalyticsQuerySchema }), getHiringAnalyticsHandler);
