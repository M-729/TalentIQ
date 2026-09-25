import { z } from "zod";
import { publicIdPattern } from "../../utils/publicId";

// Public-id only (Phase 2 cutover — see this ticket's report): a raw Mongo
// ObjectId no longer resolves as either of these URL ids — matching
// job.validation.ts's jobIdentifierString exactly. Never applies to any
// secure token (invitation accept tokens are handled entirely through
// companyInvitationResponse.validation.ts's own token field, not this
// file).
const USER_PUBLIC_ID_PATTERN = publicIdPattern("user");
const userIdentifierString = (label: string) =>
  z.string().refine((val) => USER_PUBLIC_ID_PATTERN.test(val), {
    message: `Invalid ${label}`,
  });

const INVITATION_PUBLIC_ID_PATTERN = publicIdPattern("invite");
const invitationIdentifierString = (label: string) =>
  z.string().refine((val) => INVITATION_PUBLIC_ID_PATTERN.test(val), {
    message: `Invalid ${label}`,
  });

export const userIdParamsSchema = z.object({
  userId: userIdentifierString("user id"),
});

export const invitationIdParamsSchema = z.object({
  invitationId: invitationIdentifierString("invitation id"),
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
