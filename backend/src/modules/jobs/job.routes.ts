import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import {
  createJobHandler,
  deleteJobHandler,
  getJobHandler,
  listJobsHandler,
  updateJobHandler,
} from "./job.controller";
import { createJobSchema, jobIdParamsSchema, listJobsQuerySchema, updateJobSchema } from "./job.validation";

export const jobRouter = Router();

// BRD's role table lists job management only under HR, not Admin, but also
// doesn't state Admin is excluded from it. Allowing both here (an Admin
// managing their own company's jobs) rather than inventing an HR-only
// restriction the BRD doesn't spell out — flagged for confirmation.
jobRouter.use(requireAuth, requireRole("HR", "ADMIN"));

jobRouter.post("/", validate({ body: createJobSchema }), createJobHandler);
jobRouter.get("/", validate({ query: listJobsQuerySchema }), listJobsHandler);
jobRouter.get("/:id", validate({ params: jobIdParamsSchema }), getJobHandler);
jobRouter.patch("/:id", validate({ params: jobIdParamsSchema, body: updateJobSchema }), updateJobHandler);
jobRouter.delete("/:id", validate({ params: jobIdParamsSchema }), deleteJobHandler);
