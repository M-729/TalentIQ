import { ApiError } from "@/services/api/client";

// Never surface a raw backend message here — same safe-error-mapping
// convention as offerErrors.ts / rejectionErrors.ts.
export function getCompanySignupErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400:
        return "Please check your details and try again.";
      case 409:
        return "An account with this email already exists. Try signing in instead.";
      case 429:
        return "Too many attempts. Please wait a moment and try again.";
      default:
        return "Something went wrong. Please try again.";
    }
  }
  return "Something went wrong. Please try again.";
}
