import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { listEmailActivityQuerySchema } from "./emailActivity.validation";
import { listEmailActivityHandler } from "./emailActivity.controller";

// Mounted at /api/v1/email-activity. HR and ADMIN both.
export const emailActivityRouter = Router();

emailActivityRouter.use(requireAuth, requireRole("HR", "ADMIN"));
emailActivityRouter.get("/", validate({ query: listEmailActivityQuerySchema }), listEmailActivityHandler);
