import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here. 401 is deliberately not
// special-cased — this app has no global 401 interceptor to hook into
// (matching how useJobs/useJob already handle it), so a 401 just falls
// through to the generic message like any other unexpected status.
export function getApplicationsListErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid search or filter values. Please adjust and try again.";
  }
  return "Applications could not be loaded. Please try again.";
}

export function getApplicationDetailErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid request. Please try again.";
  }
  return "Applications could not be loaded. Please try again.";
}
