import { ApiError } from "@/services/api/client";

interface ZodFlattenedDetails {
  fieldErrors?: Record<string, string[] | undefined>;
}

function isZodFlattenedDetails(details: unknown): details is ZodFlattenedDetails {
  return typeof details === "object" && details !== null && "fieldErrors" in details;
}

// Maps the backend's zod .flatten() error shape (BadRequestError's
// `details`) into a simple { field: message } record the form can show
// inline. Returns null when the error isn't a field-validation error at
// all (e.g. a 404 or 500), so the caller falls back to a general message.
export function parseApiFieldErrors(err: unknown): Record<string, string> | null {
  if (!(err instanceof ApiError) || !isZodFlattenedDetails(err.details)) {
    return null;
  }

  const fieldErrors = err.details.fieldErrors;
  if (!fieldErrors) return null;

  const result: Record<string, string> = {};
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages && messages.length > 0) {
      result[field] = messages[0]!;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}
