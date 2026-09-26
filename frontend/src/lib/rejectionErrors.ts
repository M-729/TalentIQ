import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

export function getRejectApplicationErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the details and try again.";
      case 404:
        return "This application is no longer available.";
      case 409:
        return "This application has already reached a final outcome.";
      default:
        return "The candidate could not be rejected. Try again.";
    }
  }
  return "The candidate could not be rejected. Try again.";
}

export function getRetryRejectionEmailErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "No rejection email was found to retry.";
      case 409:
        return "Only a failed rejection email can be retried.";
      default:
        return "Rejection email could not be sent.";
    }
  }
  return "Rejection email could not be sent.";
}
