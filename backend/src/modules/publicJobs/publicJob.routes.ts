import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { publicRateLimiter } from "../../middleware/rateLimit.middleware";
import { jobIdParamsSchema } from "../jobs/job.validation";
import { getPublicJobHandler } from "./publicJob.controller";

export const publicJobRouter = Router();

// Deliberately no requireAuth/requireRole here — candidates have no
// TalentIQ account, so this router must stay reachable without a session.
publicJobRouter.get("/:id", publicRateLimiter, validate({ params: jobIdParamsSchema }), getPublicJobHandler);
