import { z } from "zod";
import { Types } from "mongoose";
import { HIRING_STEP_TYPES } from "../../models/HiringStep.model";
import { publicIdPattern } from "../../utils/publicId";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

// Public-id only (Phase 2 cutover — see this ticket's report): a raw Mongo
// ObjectId no longer resolves as a HiringStep/Job URL id — matching
// job.validation.ts's jobIdentifierString exactly. jobId below is the SAME
// treatment applied to the Job parent-scoping path segment
// (`/jobs/:jobId/hiring-steps...`) — resolved to Job's real internal id by
// hiringStep.service.ts before being used against HiringStep.job_id, which
// remains a plain ObjectId reference and was never itself migrated.
// orderedStepIds is a body-level array of already-fetched ids and stays
// ObjectId-only (see this ticket's explicit "don't blindly replace every
// objectIdString validator" instruction).
const STEP_PUBLIC_ID_PATTERN = publicIdPattern("step");
const stepIdentifierString = (label: string) =>
  z.string().refine((val) => STEP_PUBLIC_ID_PATTERN.test(val), {
    message: `Invalid ${label}`,
  });

const JOB_PUBLIC_ID_PATTERN = publicIdPattern("job");
const jobIdentifierString = (label: string) =>
  z.string().refine((val) => JOB_PUBLIC_ID_PATTERN.test(val), {
    message: `Invalid ${label}`,
  });

export const jobIdParamsSchema = z.object({
  jobId: jobIdentifierString("job id"),
});

export const stepParamsSchema = z.object({
  jobId: jobIdentifierString("job id"),
  stepId: stepIdentifierString("step id"),
});

const name = z.string().trim().min(1, "Name is required").max(100, "Name is too long");
const type = z.enum(HIRING_STEP_TYPES);
const description = z.string().trim().max(1000, "Description is too long").optional();

// `.strict()` per this ticket's explicit instruction ("Prefer strict body
// validation") — job_id, company_id, position, created_at, and any
// application id are all backend-derived and must be rejected outright,
// not silently ignored, if a client sends them.
export const createHiringStepSchema = z
  .object({
    name,
    type,
    description,
  })
  .strict();

// Position is deliberately absent here — ordering only ever changes
// through the dedicated reorder endpoint below.
export const updateHiringStepSchema = z
  .object({
    name: name.optional(),
    type: type.optional(),
    description,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, { message: "At least one field must be provided" });

// Empty arrays are valid (a Job with zero stages reorders trivially) —
// the service layer is what actually enforces "this must be the Job's
// entire current stage set", since that requires knowing what currently
// exists in the database, not just shape validation.
export const reorderHiringStepsSchema = z
  .object({
    orderedStepIds: z.array(objectIdString("step id")),
  })
  .strict();

export type CreateHiringStepInput = z.infer<typeof createHiringStepSchema>;
export type UpdateHiringStepInput = z.infer<typeof updateHiringStepSchema>;
export type ReorderHiringStepsInput = z.infer<typeof reorderHiringStepsSchema>;
