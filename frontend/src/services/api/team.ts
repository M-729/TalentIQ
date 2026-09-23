import { apiClient } from "@/services/api/client";
import type { TeamInvitation, TeamMember } from "@/types/team";

export function listTeamMembers(): Promise<{ members: TeamMember[] }> {
  return apiClient.get<{ members: TeamMember[] }>("/team/members");
}

export function deactivateTeamMember(userId: string): Promise<{ member: TeamMember }> {
  return apiClient.post<{ member: TeamMember }>(`/team/members/${userId}/deactivate`);
}

export function reactivateTeamMember(userId: string): Promise<{ member: TeamMember }> {
  return apiClient.post<{ member: TeamMember }>(`/team/members/${userId}/reactivate`);
}

export function listTeamInvitations(): Promise<{ invitations: TeamInvitation[] }> {
  return apiClient.get<{ invitations: TeamInvitation[] }>("/team/invitations");
}

export function inviteTeamMember(email: string): Promise<{ invitation: TeamInvitation }> {
  return apiClient.post<{ invitation: TeamInvitation }>("/team/invitations", { email });
}

export function resendTeamInvitation(invitationId: string): Promise<{ invitation: TeamInvitation }> {
  return apiClient.post<{ invitation: TeamInvitation }>(`/team/invitations/${invitationId}/resend`);
}

export function revokeTeamInvitation(invitationId: string): Promise<{ invitation: TeamInvitation }> {
  return apiClient.post<{ invitation: TeamInvitation }>(`/team/invitations/${invitationId}/revoke`);
}
