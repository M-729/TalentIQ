import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same safe-error-mapping
// convention as offerResponseErrors.ts. Deliberately generic: this public,
// unauthenticated surface must never hint at *why* something failed beyond
// what the page's own response `state` already conveys.
export function getCompanyInvitationErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 429) return "Too many requests. Please wait a moment and try again.";
    if (err.status === 400) return "Please check your details and try again.";
  }
  return "Something went wrong. Please try again.";
}
