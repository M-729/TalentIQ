import { z } from "zod";
import { passwordSchema } from "../auth/auth.validation";

export const lookupCompanyInvitationSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
  })
  .strict();
export type LookupCompanyInvitationInput = z.infer<typeof lookupCompanyInvitationSchema>;

// Deliberately no `email`/`company_id`/`role` fields — those are never
// accepted from the client for acceptance (see this ticket's explicit
// Part 7 "Do not accept email/company/role from the client as
// authoritative" rule); they always come from the persisted invitation
// itself (see companyInvitationResponse.service.ts's acceptCompanyInvitation).
export const acceptCompanyInvitationSchema = z
  .object({
    token: z.string().trim().min(1).max(512),
    full_name: z.string().trim().min(1, "Full name is required").max(200, "Full name is too long"),
    password: passwordSchema,
  })
  .strict();
export type AcceptCompanyInvitationInput = z.infer<typeof acceptCompanyInvitationSchema>;
