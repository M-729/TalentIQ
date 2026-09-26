import { NETWORK_UNREACHABLE_MESSAGE, OFFLINE_MESSAGE, isNetworkUnreachable, isOffline } from "@/lib/apiErrorMessage";

// Never surface a raw backend message — same convention as the rest of
// this codebase's *Errors.ts modules. A completely unreachable backend is
// checked first in every function, so it shows NETWORK_UNREACHABLE_MESSAGE
// rather than the fixed fallback below.

export function getConnectUrlErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  return "Could not start the Google Calendar connection. Please try again.";
}

export function getIntegrationStatusErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  return "Google Calendar connection status could not be loaded. Please try again.";
}

export function getDisconnectErrorMessage(err: unknown): string {
  if (isOffline()) return OFFLINE_MESSAGE;
  if (isNetworkUnreachable(err)) return NETWORK_UNREACHABLE_MESSAGE;
  return "Google Calendar could not be disconnected. Please try again.";
}
