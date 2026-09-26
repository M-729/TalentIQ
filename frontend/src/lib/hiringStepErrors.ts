import { ApiError } from "@/services/api/client";
import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

export type HiringStepErrorContext = "fetch" | "create" | "update" | "delete" | "reorder";

// Never surface a raw backend message here — matches this codebase's
// existing safe-error-mapping convention (see screeningErrors.ts).
//
// The backend returns 409 for two entirely different business conflicts —
// "duplicate stage name" (create/rename) and "stage still in use by an
// Application" (delete) — through the same generic ConflictError shape,
// with no structured `code` field distinguishing them (only a fixed
// message; see backend hiringStep.service.ts). Rather than string-matching
// that message — fragile, and exactly the "unsafe string matching" this
// ticket warned against — the two cases are disambiguated by WHICH request
// produced the 409: a create/update 409 can only ever be a duplicate name,
// and a delete 409 can only ever be "stage in use". Each caller below
// passes its own fixed `context`, so this mapping never depends on
// response content at all.
export function getHiringStepErrorMessage(err: unknown, context: HiringStepErrorContext): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  if (!(err instanceof ApiError)) {
    return "The hiring pipeline could not be updated. Please try again.";
  }

  switch (err.status) {
    case 400:
      return "Please check the stage details and try again.";
    case 404:
      // The "soft-deleted Job discovered mid-session" case specifically
      // asks for this exact copy; every other 404 (a stage that no longer
      // exists, etc.) is safely covered by the same wording too.
      return context === "fetch"
        ? "This job is no longer available."
        : "This job or hiring stage is no longer available.";
    case 409:
      return context === "delete"
        ? "This stage can't be deleted because one or more applications are currently in it. Move those applicants to another stage first."
        : "A stage with this name already exists for this job.";
    default:
      return "The hiring pipeline could not be updated. Please try again.";
  }
}
