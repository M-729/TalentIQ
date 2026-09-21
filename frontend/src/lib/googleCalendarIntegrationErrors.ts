// Never surface a raw backend message — same convention as the rest of
// this codebase's *Errors.ts modules.

export function getConnectUrlErrorMessage(_err: unknown): string {
  return "Could not start the Google Calendar connection. Please try again.";
}

export function getIntegrationStatusErrorMessage(_err: unknown): string {
  return "Google Calendar connection status could not be loaded. Please try again.";
}

export function getDisconnectErrorMessage(_err: unknown): string {
  return "Google Calendar could not be disconnected. Please try again.";
}
