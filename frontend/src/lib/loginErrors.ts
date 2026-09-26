import { ApiError } from "@/services/api/client";
import { getGenericApiErrorMessage } from "@/lib/apiErrorMessage";

// The backend deliberately returns the SAME 401 "Invalid email or
// password" whether the email doesn't exist, the password is wrong, OR
// the account is deactivated (see auth.service.ts's own doc comment) —
// this is intentional account-enumeration protection, not an oversight,
// so this never tries to split "wrong password" from "inactive account"
// into two different messages the way a naive reading of "give inactive
// accounts their own message" might suggest; doing so would reintroduce
// exactly the leak the backend was written to avoid.
export function getLoginErrorMessage(err: unknown): string {
  if (err instanceof ApiError && err.status === 401) {
    return "The email or password you entered is incorrect.";
  }
  return getGenericApiErrorMessage(err, "Something went wrong. Please try again.");
}
