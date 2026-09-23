import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same safe-error-mapping
// convention as offerErrors.ts / rejectionErrors.ts. Deliberately generic:
// this public, unauthenticated surface must never hint at *why* something
// failed (invalid token vs. server error) beyond what the page's own
// response_state already conveys.
export function getOfferResponseErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) {
    return "Too many requests. Please wait a moment and try again.";
  }
  return "Something went wrong. Please try again.";
}
