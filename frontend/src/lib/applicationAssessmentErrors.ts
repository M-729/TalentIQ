import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Never surface a raw backend message here — same safe-error-mapping
// convention as interviewErrors.ts / hiringPipelineBoardErrors.ts.

export function getAssessmentErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the assessment details and try again.";
      case 404:
        return "This application or assessment is no longer available.";
      case 409:
        return "This assessment can no longer be changed right now — it may already exist, or a result has already been recorded.";
      default:
        return "Assessment could not be saved. Try again.";
    }
  }
  return "Assessment could not be saved. Try again.";
}

export function getRecordResultErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the result details and try again.";
      case 404:
        return "This assessment is no longer available.";
      default:
        return "The result could not be saved. Try again.";
    }
  }
  return "The result could not be saved. Try again.";
}

export function getSendAssessmentErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This assessment is no longer available.";
      case 409:
        return "An invitation is already being sent for this assessment.";
      default:
        return "Assessment email could not be sent.";
    }
  }
  return "Assessment email could not be sent.";
}

export function getRetryAssessmentNotificationErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This notification is no longer available.";
      case 409:
        return "Only a failed invitation can be retried.";
      default:
        return "Assessment email could not be sent.";
    }
  }
  return "Assessment email could not be sent.";
}

export function getAssessmentsListErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid filter values. Please adjust and try again.";
  }
  return "Assessments could not be loaded. Please try again.";
}
