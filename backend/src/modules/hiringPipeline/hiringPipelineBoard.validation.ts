import { z } from "zod";
import { Types } from "mongoose";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const jobIdParamsSchema = z.object({
  jobId: objectIdString("job id"),
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
