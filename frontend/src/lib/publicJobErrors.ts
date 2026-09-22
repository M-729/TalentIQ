import { ApiError } from "@/services/api/client";

// Never surface a raw backend message on a candidate-facing page — same
// convention as applicationErrors.ts/interviewErrors.ts.
export function getPublicJobsListErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 400) {
    return "Invalid search. Please adjust and try again.";
  }
  return "Open positions could not be loaded. Please try again.";
}
