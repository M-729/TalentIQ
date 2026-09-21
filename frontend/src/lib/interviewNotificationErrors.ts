import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same convention as the rest
// of this codebase's *Errors.ts modules.

export function getInterviewNotificationsErrorMessage(_err: unknown): string {
  return "Notification history could not be loaded. Please try again.";
}

export function getRetryNotificationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This notification is no longer available.";
      case 409:
        return "Only failed notifications can be retried.";
      default:
        return "The email could not be resent. Please try again.";
    }
  }
  return "The email could not be resent. Please try again.";
}
