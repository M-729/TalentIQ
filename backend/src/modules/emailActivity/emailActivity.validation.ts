import { z } from "zod";
import { EMAIL_NOTIFICATION_CATEGORIES, EMAIL_NOTIFICATION_STATUSES } from "../../models/EmailNotification.model";

// The 6 real recruitment categories plus "company_invitation" — the ONLY
// types that actually exist in this codebase's data (see
// emailActivity.service.ts's own doc comment). Deliberately does NOT
// include an "application_confirmation" type: no such EmailNotification
// category is ever created anywhere in this codebase today — inventing
// one here would violate this ticket's explicit "no fake metrics/real
// data only" rule.
export const EMAIL_ACTIVITY_TYPES = [...EMAIL_NOTIFICATION_CATEGORIES, "company_invitation"] as const;
export type EmailActivityType = (typeof EMAIL_ACTIVITY_TYPES)[number];

const optionalSearch = z.preprocess(
  (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
  z.string().trim().min(1).max(200).optional()
);

// Deliberately NOT `.strict()` — query schemas in this codebase never are
// (offer.validation.ts's listOffersQuerySchema is the precedent).
export const listEmailActivityQuerySchema = z.object({
  search: optionalSearch,
  type: z.enum(EMAIL_ACTIVITY_TYPES).optional(),
  status: z.enum(EMAIL_NOTIFICATION_STATUSES).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export type ListEmailActivityQuery = z.infer<typeof listEmailActivityQuerySchema>;
