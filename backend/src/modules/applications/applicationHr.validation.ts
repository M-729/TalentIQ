import { z } from "zod";
import { APPLICATION_STATUSES } from "../../models/Application.model";
import { publicIdPattern } from "../../utils/publicId";
import { jobIdentifierString } from "../jobs/job.validation";

// Public-id only (Phase 2 cutover — see this ticket's report): a raw Mongo
// ObjectId no longer resolves as an Application URL id — matching
// job.validation.ts's jobIdentifierString exactly. Exported so every other
// module whose routes take an :applicationId path param (assessments,
// interviews, screenings, offers, rejection, stageTransitions) can reuse
// this single definition instead of each duplicating it.
const APPLICATION_PUBLIC_ID_PATTERN = publicIdPattern("app");

export const applicationIdentifierString = (label: string) =>
  z.string().refine((val) => APPLICATION_PUBLIC_ID_PATTERN.test(val), {
    message: `Invalid ${label}`,
  });

export const applicationIdParamsSchema = z.object({
  applicationId: applicationIdentifierString("application id"),
});

// An untouched search box submits "", not undefined — normalize that to
// "no filter" rather than rejecting it, matching the optionalText/
// optionalUrl convention in application.validation.ts.
const optionalSearch = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).optional()
);

export const listApplicationsQuerySchema = z.object({
  status: z.enum(APPLICATION_STATUSES).optional(),
  jobId: jobIdentifierString("job id").optional(),
  search: optionalSearch,
  page: z.coerce.number().int().positive().default(1),
  // Safe max limit so a client can't request an unbounded page size.
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
