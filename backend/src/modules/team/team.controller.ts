import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as invitationService from "./companyInvitation.service";
import * as memberService from "./member.service";
import { serializeMember, serializeInvitations } from "./team.serializer";
import type { InviteTeamMemberInput } from "./team.validation";

export const listMembersHandler = asyncHandler(async (req: Request, res: Response) => {
  const members = await memberService.listCompanyMembers(req.auth!.companyId);
  res.status(200).json({ members: members.map(serializeMember) });
});

export const deactivateMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  const member = await memberService.deactivateMember(req.auth!.companyId, req.auth!.userId, req.params.userId as string);
  res.status(200).json({ member: serializeMember(member) });
});

export const reactivateMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  const member = await memberService.reactivateMember(req.auth!.companyId, req.params.userId as string);
  res.status(200).json({ member: serializeMember(member) });
});

export const listInvitationsHandler = asyncHandler(async (req: Request, res: Response) => {
  const invitations = await invitationService.listCompanyInvitations(req.auth!.companyId);
  res.status(200).json({ invitations: await serializeInvitations(invitations) });
});

export const inviteTeamMemberHandler = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body as InviteTeamMemberInput;
  const invitation = await invitationService.inviteTeamMember(req.auth!.companyId, req.auth!.userId, email);
  const [dto] = await serializeInvitations([invitation]);
  res.status(201).json({ invitation: dto });
});

export const resendInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const invitation = await invitationService.resendTeamInvitation(req.auth!.companyId, req.params.invitationId as string);
  const [dto] = await serializeInvitations([invitation]);
  res.status(200).json({ invitation: dto });
});

export const revokeInvitationHandler = asyncHandler(async (req: Request, res: Response) => {
  const invitation = await invitationService.revokeTeamInvitation(req.auth!.companyId, req.params.invitationId as string);
  const [dto] = await serializeInvitations([invitation]);
  res.status(200).json({ invitation: dto });
});
