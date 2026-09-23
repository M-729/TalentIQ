import { z } from "zod";
import { Types } from "mongoose";
import { OFFER_CURRENCIES, OFFER_STATUSES } from "../../models/Offer.model";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const applicationIdParamsSchema = z.object({
  applicationId: objectIdString("application id"),
});

export const offerIdParamsSchema = z.object({
  offerId: objectIdString("offer id"),
});

export const notificationIdParamsSchema = z.object({
  offerId: objectIdString("offer id"),
  notificationId: objectIdString("notification id"),
});

const titleSchema = z.string().trim().min(1, "Offer title is required").max(150, "Offer title is too long");

// Positive, finite, and at most 2 decimal places ("sensible decimal
// handling" per this ticket's explicit Part 8) — e.g. 95000 or 95000.50,
// never 95000.999 or Infinity/NaN.
const salaryAmountSchema = z
  .number()
  .positive("Salary must be a positive number")
  .finite("Salary must be a finite number")
  .refine((val) => Math.abs(val * 100 - Math.round(val * 100)) < 1e-9, { message: "Salary supports at most 2 decimal places" });

const currencySchema = z.enum(OFFER_CURRENCIES);

const employmentTypeSchema = z.string().trim().max(100, "Employment type is too long").nullable();
const dateSchema = z.string().datetime({ message: "Invalid date" });
const candidateMessageSchema = z.string().trim().max(4000, "Message is too long").nullable();
const internalNotesSchema = z.string().trim().max(4000, "Notes are too long").nullable();

// Salary amount/currency are always paired — a bare number with no
// currency (or vice versa) is ambiguous, never accepted (see this ticket's
// explicit "prefer ISO currency code" Part 8 guidance).
function requireSalaryPairing(data: { salary_amount?: number | null; salary_currency?: string | null }, ctx: z.RefinementCtx): void {
  const hasAmount = data.salary_amount !== undefined && data.salary_amount !== null;
  const hasCurrency = data.salary_currency !== undefined && data.salary_currency !== null;
  if (hasAmount !== hasCurrency) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Salary amount and currency must be provided together",
      path: ["salary_currency"],
    });
  }
}

// `.strict()` — company_id/application_id/candidate_id/job_id/status/
// created_by/updated_by/sent_at/accepted_at/declined_at/withdrawn_at are
// all backend-derived and never accepted from the client (see
// offer.service.ts's createOffer).
export const createOfferSchema = z
  .object({
    title: titleSchema,
    salary_amount: salaryAmountSchema.nullable().optional(),
    salary_currency: currencySchema.nullable().optional(),
    employment_type: employmentTypeSchema.optional(),
    start_date: dateSchema.nullable().optional(),
    expires_at: dateSchema.nullable().optional(),
    candidate_message: candidateMessageSchema.optional(),
    internal_notes: internalNotesSchema.optional(),
  })
  .strict()
  .superRefine(requireSalaryPairing);
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

// Same fields, all optional — editing a Draft offer only (see
// offer.service.ts's updateOffer, which rejects this once status is no
// longer "draft"). Deliberately NOT superRefine-paired like createOfferSchema
// above: an edit may touch only ONE of salary_amount/salary_currency while
// the other keeps its already-stored value from a previous edit, which
// this schema alone cannot see — offer.service.ts's updateOffer checks the
// pairing rule against the FINAL merged document state instead.
export const updateOfferSchema = z
  .object({
    title: titleSchema.optional(),
    salary_amount: salaryAmountSchema.nullable().optional(),
    salary_currency: currencySchema.nullable().optional(),
    employment_type: employmentTypeSchema.optional(),
    start_date: dateSchema.nullable().optional(),
    expires_at: dateSchema.nullable().optional(),
    candidate_message: candidateMessageSchema.optional(),
    internal_notes: internalNotesSchema.optional(),
  })
  .strict();
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

// Send/Accept/Decline/Withdraw/Hire/Retry all accept no business input at
// all — every fact they need is always reconstructed from trusted,
// persisted TalentIQ data, matching sendAssessmentBodySchema's precedent
// exactly.
export const offerActionBodySchema = z.object({}).strict();

const optionalSearch = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).max(200).optional()
);

// ===== /offers company-wide list ===== Deliberately NOT `.strict()` —
// query schemas in this codebase never are (applicationHr.validation.ts's
// listApplicationsQuerySchema is the precedent).
export const listOffersQuerySchema = z.object({
  jobId: objectIdString("job id").optional(),
  status: z.enum(OFFER_STATUSES).optional(),
  search: optionalSearch,
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>;
