import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { getDashboardHandler } from "./dashboard.controller";

// Mounted at /api/v1/dashboard. HR and ADMIN both — matches every other
// module's role policy except Team (see role.middleware.ts's precedent).
export const dashboardRouter = Router();

dashboardRouter.use(requireAuth, requireRole("HR", "ADMIN"));
dashboardRouter.get("/", getDashboardHandler);
