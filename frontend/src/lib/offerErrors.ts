import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Never surface a raw backend message here — same safe-error-mapping
// convention as applicationAssessmentErrors.ts / interviewErrors.ts. A
// completely unreachable backend is checked first in every function, so
// it always shows NETWORK_UNREACHABLE_MESSAGE rather than a page-specific
// fallback — see apiErrorMessage.ts's own doc comment for why.

export function getOfferErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the offer details and try again.";
      case 404:
        return "This application or offer is no longer available.";
      case 409:
        return "This offer can no longer be changed right now — it may already be locked, or its state has changed.";
      default:
        return "Offer could not be saved. Try again.";
    }
  }
  return "Offer could not be saved. Try again.";
}

export function getOfferTransitionErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This offer is no longer available.";
      case 409:
        return "This offer's state has changed. Please refresh and try again.";
      default:
        return "This action could not be completed. Try again.";
    }
  }
  return "This action could not be completed. Try again.";
}

export function getSendOfferErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This offer is no longer available.";
      case 409:
        return "This offer has already been sent or its state has changed.";
      default:
        return "Offer email could not be sent.";
    }
  }
  return "Offer email could not be sent.";
}

export function getRetryOfferNotificationErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This notification is no longer available.";
      case 409:
        return "Only a failed offer email can be retried.";
      default:
        return "Offer email could not be sent.";
    }
  }
  return "Offer email could not be sent.";
}

export function getOffersListErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid filter values. Please adjust and try again.";
  }
  return "Offers could not be loaded. Please try again.";
}
