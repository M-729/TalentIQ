import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same convention as
// hiringPipelineBoardErrors.ts / applicationErrors.ts.

export function getInterviewsListErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid filter values. Please adjust and try again.";
  }
  return "Interviews could not be loaded. Please try again.";
}

export function getInterviewDetailErrorMessage(_err: unknown): string {
  return "This interview could not be loaded. Please try again.";
}

export function getScheduleInterviewErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the interview details and try again.";
      case 404:
        return "This application is no longer available.";
      case 409:
        return "An interview is already scheduled for this stage, or this application is not currently eligible for scheduling.";
      default:
        return "The interview could not be scheduled. Please try again.";
    }
  }
  return "The interview could not be scheduled. Please try again.";
}

export function getRescheduleInterviewErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the interview details and try again.";
      case 404:
        return "This interview is no longer available.";
      case 409:
        return "This interview changed while you were working. Refresh and try again.";
      default:
        return "The interview could not be rescheduled. Please try again.";
    }
  }
  return "The interview could not be rescheduled. Please try again.";
}

export function getCancelInterviewErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This interview is no longer available.";
      case 409:
        return "This interview changed while you were working. Refresh and try again.";
      default:
        return "The interview could not be cancelled. Please try again.";
    }
  }
  return "The interview could not be cancelled. Please try again.";
}

// Shared by "Add to Google Calendar" and "Sync Calendar" — the backend
// maps every real Google failure to one of a fixed set of safe HTTP
// statuses (see interviewCalendarSync.service.ts's mapProviderErrorToAppError);
// this mirrors those categories without ever needing the underlying
// provider-neutral error code (which the API doesn't expose to the
// client — see this ticket's Part 11).
export function getCalendarActionErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 409:
        return "Reconnect Google Calendar to continue, or check the connection in Settings.";
      case 503:
        return "Google Calendar is temporarily rate-limited or unavailable. Please try again shortly.";
      case 502:
        return "Google Calendar could not complete this request. Please try again.";
      case 400:
        return "Please check the request and try again.";
      default:
        return "This Google Calendar action could not be completed. Please try again.";
    }
  }
  return "This Google Calendar action could not be completed. Please try again.";
}

export function getInterviewerDirectoryErrorMessage(_err: unknown): string {
  return "Interviewers could not be loaded. Please try again.";
}
