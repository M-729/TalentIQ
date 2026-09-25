import { z } from "zod";
import { Types } from "mongoose";
import { jobIdentifierString } from "../jobs/job.validation";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

// jobId is the Job parent-scoping path segment
// (`/jobs/:jobId/hiring-pipeline...`) — public_id only (Phase 2 cutover),
// resolved to Job's real internal id by
// hiringPipelineBoard.service.ts before being used against any
// Application/HiringStep job_id query, which remain plain ObjectId
// references and were never themselves migrated. application_ids/
// target_hiring_step_id below are body-level arrays of already-fetched
// ids and stay ObjectId-only (see job.validation.ts's own "don't blindly
// replace every objectIdString validator" note).
export const jobIdParamsSchema = z.object({
  jobId: jobIdentifierString("job id"),
});

// A generous but bounded batch size — large enough for a real HR bulk
// action, small enough that a single bulkWrite + insertMany transaction
// stays fast and the request body stays sane. See hiringPipelineBoard
// .service.ts's bulkMoveApplications for how this is enforced end to end.
export const MAX_BULK_MOVE_APPLICATIONS = 100;

// `.strict()` — company_id/status/interviewer/assessment data are all
// backend-derived or simply never accepted, same convention as
// stageTransition.validation.ts's moveApplicationStageSchema. Duplicate
// application ids are rejected outright (not silently deduplicated) —
// the frontend selection is always a Set, so a duplicate here can only
// mean a malformed/hand-crafted request, and a clear 400 is safer than a
// guessed dedup contract.
export const bulkMoveApplicationsSchema = z
  .object({
    application_ids: z
      .array(objectIdString("application id"))
      .min(1, "At least one application id is required")
      .max(MAX_BULK_MOVE_APPLICATIONS, `At most ${MAX_BULK_MOVE_APPLICATIONS} applications may be moved at once`)
      .refine((ids) => new Set(ids).size === ids.length, { message: "Duplicate application ids are not allowed" }),
    target_hiring_step_id: objectIdString("target hiring step id"),
  })
  .strict();

export type BulkMoveApplicationsInput = z.infer<typeof bulkMoveApplicationsSchema>;
