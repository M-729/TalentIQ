import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same safe-error-mapping
// convention as screeningErrors.ts / hiringStepErrors.ts.
export function getBoardErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 404:
        return "This job is no longer available.";
      case 413:
        return "This pipeline contains too many active applications to load at once.";
      default:
        return "The hiring pipeline could not be loaded.";
    }
  }
  return "The hiring pipeline could not be loaded.";
}

// The movement endpoint's 409 covers several distinct backend conflicts
// (same-stage race, terminal-status change, concurrent recruiter
// movement, inconsistent current-step data) that all share one generic
// message-less ConflictError — a single safe "state changed, refresh and
// retry" message covers all of them without string-matching backend text.
export function getMoveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the movement details and try again.";
      case 404:
        return "This application or hiring stage is no longer available.";
      case 409:
        return "This application changed while you were working. Refresh the pipeline and try again.";
      default:
        return "The hiring pipeline could not be updated. Please try again.";
    }
  }
  return "The hiring pipeline could not be updated. Please try again.";
}

// The bulk endpoint's 409 covers both "one or more candidates changed
// concurrently" and "one or more candidates are already in the destination
// stage" — a single safe message that never implies a partial success,
// since the backend guarantees all-or-nothing.
export function getBulkMoveErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check the selected candidates and destination and try again.";
      case 404:
        return "This job, one of the selected applications, or the destination stage is no longer available.";
      case 409:
        return "One or more selected candidates changed, or are already in that stage. Refresh the pipeline and try again.";
      default:
        return "No candidates were moved. Please try again.";
    }
  }
  return "No candidates were moved. Please try again.";
}
