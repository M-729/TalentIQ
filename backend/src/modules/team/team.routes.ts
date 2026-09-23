import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireRole } from "../../middleware/role.middleware";
import { validate } from "../../middleware/validate.middleware";
import { inviteTeamMemberSchema, invitationIdParamsSchema, teamActionBodySchema, userIdParamsSchema } from "./team.validation";
import {
  deactivateMemberHandler,
  inviteTeamMemberHandler,
  listInvitationsHandler,
  listMembersHandler,
  reactivateMemberHandler,
  resendInvitationHandler,
  revokeInvitationHandler,
} from "./team.controller";

// Mounted at /api/v1/team. Deliberately ADMIN-only for the WHOLE router
// (see this ticket's explicit "Settings -> Team Members ... ADMIN only"
// Part 3 rule) — unlike most other modules in this codebase, which allow
// both "HR", "ADMIN", this is not a shared HR workflow surface, so there
// is no listing-only carve-out for HR here.
export const teamRouter = Router();

teamRouter.use(requireAuth, requireRole("ADMIN"));

teamRouter.get("/members", listMembersHandler);
teamRouter.post("/members/:userId/deactivate", validate({ params: userIdParamsSchema, body: teamActionBodySchema }), deactivateMemberHandler);
teamRouter.post("/members/:userId/reactivate", validate({ params: userIdParamsSchema, body: teamActionBodySchema }), reactivateMemberHandler);

teamRouter.get("/invitations", listInvitationsHandler);
teamRouter.post("/invitations", validate({ body: inviteTeamMemberSchema }), inviteTeamMemberHandler);
teamRouter.post(
  "/invitations/:invitationId/resend",
  validate({ params: invitationIdParamsSchema, body: teamActionBodySchema }),
  resendInvitationHandler
);
teamRouter.post(
  "/invitations/:invitationId/revoke",
  validate({ params: invitationIdParamsSchema, body: teamActionBodySchema }),
  revokeInvitationHandler
);
