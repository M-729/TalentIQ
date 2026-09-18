import { Router } from "express";
import { validate } from "../../middleware/validate.middleware";
import { applicationRateLimiter, publicRateLimiter } from "../../middleware/rateLimit.middleware";
import { cvUpload } from "../../middleware/upload.middleware";
import { jobIdParamsSchema } from "../jobs/job.validation";
import { submitApplicationHandler } from "../applications/application.controller";
import { submitApplicationSchema } from "../applications/application.validation";
import { getPublicJobHandler } from "./publicJob.controller";

export const publicJobRouter = Router();

// Deliberately no requireAuth/requireRole on this whole router — candidates
// have no TalentIQ account, so it must stay reachable without a session.
publicJobRouter.get("/:id", publicRateLimiter, validate({ params: jobIdParamsSchema }), getPublicJobHandler);

// Rate limiting first (reject abuse before doing any multipart parsing),
// then multer (multipart/form-data — populates req.body's text fields and
// req.file for "cv"), then :id and body validation, then the handler.
//
// Multer runs before validation, not after, even though that means it
// also processes uploads for requests that will later fail validation —
// deliberately, so the incoming multipart body stream is always fully
// drained regardless of what validation decides. Validating :id first and
// only running multer afterward left the client's in-flight multipart
// body undrained whenever the id was invalid, which could reset the
// connection instead of cleanly returning 400.
publicJobRouter.post(
  "/:id/applications",
  applicationRateLimiter,
  cvUpload,
  validate({ params: jobIdParamsSchema, body: submitApplicationSchema }),
  submitApplicationHandler
);
