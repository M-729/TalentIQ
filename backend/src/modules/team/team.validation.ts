import { z } from "zod";
import { Types } from "mongoose";

const objectIdString = (label: string) =>
  z.string().refine((val) => Types.ObjectId.isValid(val), { message: `Invalid ${label}` });

export const userIdParamsSchema = z.object({
  userId: objectIdString("user id"),
});

export const invitationIdParamsSchema = z.object({
  invitationId: objectIdString("invitation id"),
});

// `.strict()` — role/company_id/status/etc are never accepted from the
// client (see this ticket's explicit "Do NOT allow arbitrary ADMIN
// creation through invitations" rule): the invited role is always the
// server-decided "HR" (see companyInvitation.service.ts's inviteTeamMember).
export const inviteTeamMemberSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Invalid email address"),
  })
  .strict();
export type InviteTeamMemberInput = z.infer<typeof inviteTeamMemberSchema>;

// Resend/Revoke/Deactivate/Reactivate all accept no business input — every
// fact they need is already persisted, matching offer.validation.ts's
// offerActionBodySchema precedent exactly.
export const teamActionBodySchema = z.object({}).strict();
