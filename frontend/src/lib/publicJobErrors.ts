import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Never surface a raw backend message on a candidate-facing page — same
// convention as applicationErrors.ts/interviewErrors.ts.
export function getPublicJobsListErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid search. Please adjust and try again.";
  }
  return "Open positions could not be loaded. Please try again.";
}
