import { z } from "zod";

// An untouched search box submits "", not undefined — normalize that to
// "no filter" rather than rejecting it, matching
// applicationHr.validation.ts's identical optionalSearch convention.
const optionalSearch = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).max(200).optional()
);

// location/employment_type/department are free-text fields on Job.model.ts
// (no fixed enum), so these are case-insensitive substring filters, same
// as `search` — never a dropdown over values this model doesn't constrain.
export const listPublicJobsQuerySchema = z.object({
  search: optionalSearch,
  location: optionalSearch,
  employmentType: optionalSearch,
  department: optionalSearch,
  page: z.coerce.number().int().positive().default(1),
  // Safe max limit so a client can't request an unbounded page size — same
  // convention as every other paginated list in this codebase.
  limit: z.coerce.number().int().positive().max(50).default(20),
});

export type ListPublicJobsQuery = z.infer<typeof listPublicJobsQuerySchema>;
