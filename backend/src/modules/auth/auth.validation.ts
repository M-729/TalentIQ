import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// The single canonical password-creation policy for this codebase — reused
// by company signup below and by companyInvitationResponse.validation.ts's
// acceptCompanyInvitationSchema, so both account-creation paths enforce
// exactly the same rule. (loginSchema's password field above is
// deliberately NOT this schema: login only needs "something was typed",
// not a strength check — the strength check belongs at creation time.)
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters");

// `.strict()` — role/company_id/permissions/is_admin/is_active/etc are
// never accepted from the client (see this ticket's explicit "the server
// decides all privileged values" rule): the first User of a newly-created
// Company is always role="ADMIN", status="active", scoped to the Company
// this same request creates — see auth.service.ts's signupCompany.
export const companySignupSchema = z
  .object({
    full_name: z.string().trim().min(1, "Full name is required").max(200, "Full name is too long"),
    email: z.string().trim().toLowerCase().email("Invalid email address"),
    password: passwordSchema,
    company_name: z.string().trim().min(1, "Company name is required").max(200, "Company name is too long"),
  })
  .strict();
export type CompanySignupInput = z.infer<typeof companySignupSchema>;
