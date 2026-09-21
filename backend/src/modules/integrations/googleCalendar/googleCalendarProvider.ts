import { realGoogleCalendarProvider } from "./googleCalendar.service";
import type { GoogleCalendarProvider } from "./googleCalendar.types";

// The single point application code depends on — matches
// services/storage/cvStorage.service.ts and services/email/email.service.ts's
// own "one swappable export" pattern exactly. Swapping providers later
// (or adding a second one) means changing only this file's export, never
// interviewCalendarSync.service.ts or anything else that already consumes
// the GoogleCalendarProvider interface. Tests mock this entire module, so
// no test ever calls real Google.
export const googleCalendarProvider: GoogleCalendarProvider = realGoogleCalendarProvider;

export {
  GoogleCalendarProviderError,
  CALENDAR_SYNC_ERROR_CODES,
  type GoogleCalendarErrorCode,
  type GoogleCalendarEventInput,
  type GoogleCalendarEventResult,
  type GoogleCalendarProvider,
} from "./googleCalendar.types";
