import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same safe-error-mapping
// convention as offerErrors.ts / rejectionErrors.ts.

export function getTeamListErrorMessage(err: unknown): string {
  void err;
  return "Team data could not be loaded. Please try again.";
}

export function getInviteTeamMemberErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please enter a valid email address.";
      case 409:
        return "This person cannot be invited right now — they may already be a team member or have a pending invitation.";
      default:
        return "Invitation could not be sent. Try again.";
    }
  }
  return "Invitation could not be sent. Try again.";
}

export function getInvitationActionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This invitation is no longer available.";
      case 409:
        return "This invitation's state has changed. Please refresh and try again.";
      default:
        return "This action could not be completed. Try again.";
    }
  }
  return "This action could not be completed. Try again.";
}

export function getMemberActionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This team member is no longer available.";
      case 409:
        return "This action isn't available for this account right now.";
      default:
        return "This action could not be completed. Try again.";
    }
  }
  return "This action could not be completed. Try again.";
}
