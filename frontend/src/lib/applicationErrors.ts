import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Never surface a raw backend message here. 401 is deliberately not
// special-cased — this app has no global 401 interceptor to hook into
// (matching how useJobs/useJob already handle it), so a 401 just falls
// through to the generic message like any other unexpected status. A
// completely unreachable backend (stopped/no network) is checked FIRST,
// before that generic fallback, so it always shows
// NETWORK_UNREACHABLE_MESSAGE instead of "Applications could not be
// loaded" — see apiErrorMessage.ts's own doc comment for why.
export function getApplicationsListErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid search or filter values. Please adjust and try again.";
  }
  return "Applications could not be loaded. Please try again.";
}

export function getApplicationDetailErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid request. Please try again.";
  }
  return "Applications could not be loaded. Please try again.";
}
