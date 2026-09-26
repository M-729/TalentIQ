import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Never surface a raw backend message here — same safe-error-mapping
// convention as offerResponseErrors.ts. Deliberately generic: this public,
// unauthenticated surface must never hint at *why* something failed beyond
// what the page's own response `state` already conveys. An unreachable
// backend is a distinct, safe-to-name condition (nothing to do with the
// invitation token itself), so it's checked first rather than folded into
// the generic fallback.
export function getCompanyInvitationErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError) {
    if (err.status === 429) return "Too many requests. Please wait a moment and try again.";
    if (err.status === 400) return "Please check your details and try again.";
  }
  return "Something went wrong. Please try again.";
}
