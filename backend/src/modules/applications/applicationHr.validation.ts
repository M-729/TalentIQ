import { z } from "zod";
import { Types } from "mongoose";
import { APPLICATION_STATUSES } from "../../models/Application.model";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const applicationIdParamsSchema = z.object({
  applicationId: objectIdString("application id"),
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
  jobId: objectIdString("job id").optional(),
  search: optionalSearch,
  page: z.coerce.number().int().positive().default(1),
  // Safe max limit so a client can't request an unbounded page size.
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;
