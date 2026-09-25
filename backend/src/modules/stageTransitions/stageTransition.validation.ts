import { z } from "zod";
import { Types } from "mongoose";
import { applicationIdentifierString } from "../applications/applicationHr.validation";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const applicationIdParamsSchema = z.object({
  applicationId: applicationIdentifierString("application id"),
});

// `.strict()` — every field this action needs beyond step_id/note is
// backend-derived (application status, from_step, job_id, company_id,
// moved_by, stage name/type snapshot, timestamps). Rejecting an unknown
// field outright rather than silently ignoring it matches the same
// deliberate divergence hiringStep.validation.ts and
// createScreeningBodySchema already use for identical reasons.
export const moveApplicationStageSchema = z
  .object({
    step_id: objectIdString("step id"),
    note: z.string().trim().max(1000, "Note is too long").optional(),
  })
  .strict();

export type MoveApplicationStageInput = z.infer<typeof moveApplicationStageSchema>;
