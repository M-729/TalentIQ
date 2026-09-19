import { z } from "zod";
import { Types } from "mongoose";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const applicationIdParamsSchema = z.object({
  applicationId: objectIdString("application id"),
});

// POST accepts no business input at all — every field is backend-derived
// (job id, company id, score, model/provider, prompt, required skills,
// candidate data, analysis, match result, formula version). `.strict()`
// is a deliberate divergence from this codebase's usual non-strict
// request-body schemas (job.validation.ts etc. silently ignore unknown
// fields) — the same divergence already exists in cvAnalysis.schema.ts
// for the identical reason: reject an unexpected field outright rather
// than silently accepting and ignoring it, since here every conceivable
// unexpected field would be an attempt to control something the client
// must never control.
export const createScreeningBodySchema = z.object({}).strict();

export type ApplicationIdParams = z.infer<typeof applicationIdParamsSchema>;
