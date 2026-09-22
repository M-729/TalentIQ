import { z } from "zod";
import { Types } from "mongoose";
import { APPLICATION_ASSESSMENT_STATUSES } from "../../models/ApplicationAssessment.model";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const applicationIdParamsSchema = z.object({
  applicationId: objectIdString("application id"),
});

export const assessmentIdParamsSchema = z.object({
  assessmentId: objectIdString("assessment id"),
});

export const notificationIdParamsSchema = z.object({
  assessmentId: objectIdString("assessment id"),
  notificationId: objectIdString("notification id"),
});

// Only http/https — explicitly rejects javascript:/data:/file:/every other
// scheme via the allow-list itself (never a blocklist), matching this
// ticket's explicit Part 5/10 security requirement. z.url() alone accepts
// any scheme (including javascript:), so the protocol is checked
// separately.
const externalUrlSchema = z
  .string()
  .trim()
  .min(1, "External URL is required")
  .max(2000, "External URL is too long")
  .refine(
    (value) => {
      try {
        return ["http:", "https:"].includes(new URL(value).protocol);
      } catch {
        return false;
      }
    },
    { message: "External URL must be a valid http or https link" }
  );

const nameSchema = z.string().trim().min(1, "Name is required").max(150, "Name is too long");

// `.strict()` — company_id/application_id/job_id/hiring_step_id/status/
// grade/notes/created_by/updated_by are all backend-derived and never
// accepted from the client (see applicationAssessment.service.ts's
// createAssessment).
export const createAssessmentSchema = z
  .object({
    name: nameSchema,
    external_url: externalUrlSchema,
  })
  .strict();
export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

// Edits the external-facing link/name only — never status/grade/notes/
// audit fields (see this ticket's explicit Part 7 "do not silently
// overwrite result/audit fields"). Both fields optional so HR can correct
// just one without resending the other.
export const updateAssessmentLinkSchema = z
  .object({
    name: nameSchema.optional(),
    external_url: externalUrlSchema.optional(),
  })
  .strict();
export type UpdateAssessmentLinkInput = z.infer<typeof updateAssessmentLinkSchema>;

// Grade is an optional 0-100 percentage HR enters by hand — never derived
// from status, never required to set a Passed/Failed result (see this
// ticket's explicit Part 2/6). `nullable()` lets HR explicitly clear a
// previously-entered grade.
const gradeSchema = z.number().min(0, "Grade must be at least 0").max(100, "Grade must be at most 100").nullable();
const notesSchema = z.string().trim().max(4000, "Notes are too long").nullable();

export const recordAssessmentResultSchema = z
  .object({
    status: z.enum(APPLICATION_ASSESSMENT_STATUSES),
    grade: gradeSchema.optional(),
    notes: notesSchema.optional(),
  })
  .strict();
export type RecordAssessmentResultInput = z.infer<typeof recordAssessmentResultSchema>;

// Send/Send Again/Retry all accept no business input at all — recipient/
// subject/body are always reconstructed from trusted persisted TalentIQ
// data, matching interviewNotification.validation.ts's retryNotificationBodySchema
// precedent exactly.
export const sendAssessmentBodySchema = z.object({}).strict();

// An untouched search box submits "", not undefined — normalize that to
// "no filter" rather than rejecting it, matching applicationHr.validation
// .ts's own optionalSearch convention exactly.
const optionalSearch = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).max(200).optional()
);

// ===== /assessments company-wide list ===== Deliberately NOT `.strict()`
// — query schemas in this codebase never are (applicationHr.validation
// .ts's listApplicationsQuerySchema is the precedent), since query strings
// can pick up harmless extra params.
export const listAssessmentsQuerySchema = z.object({
  jobId: objectIdString("job id").optional(),
  status: z.enum(APPLICATION_ASSESSMENT_STATUSES).optional(),
  search: optionalSearch,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListAssessmentsQuery = z.infer<typeof listAssessmentsQuerySchema>;
