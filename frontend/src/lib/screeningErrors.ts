import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Maps the screening API's HTTP status codes to safe, HR-facing copy.
// Never surface a raw backend message here — Groq/R2/parser internals
// must never reach the UI (matches the backend's own error-safety design:
// see backend/src/modules/screenings/screening.errors.ts). A completely
// unreachable backend is checked first, so it shows
// NETWORK_UNREACHABLE_MESSAGE rather than the generic "Something went
// wrong" fallback below.
export function getScreeningErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    switch (err.status) {
      case 422:
        return "We couldn't analyze this CV. It may not contain extractable text or may be in an unsupported format.";
      case 502:
        return "The AI response could not be processed. Please try again.";
      case 503:
        return "AI screening is temporarily unavailable. Please try again later.";
      case 429:
        return "You've reached the AI screening limit. Please try again later.";
      case 404:
        return "This application is unavailable.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
