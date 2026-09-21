// Computed once at module load (Node/V8's ICU data), not per call — this
// is a fixed ~400-entry list, so a Set lookup is both cheap and exact
// (matches only real IANA identifiers, e.g. rejects "PST" or "GMT+3"
// which are not valid `timeZone` values for Intl/date libraries downstream).
const VALID_IANA_TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

export function isValidIanaTimeZone(timezone: string): boolean {
  return VALID_IANA_TIME_ZONES.has(timezone);
}

// Candidate-facing email date/time formatting — Intl.DateTimeFormat's
// `timeZone` option applies the real IANA tz database (DST included),
// never a hand-rolled UTC offset table. Never hard-codes a single
// timezone (e.g. Beirut); always renders in the Interview's own
// persisted `timezone` field, whatever it is.

/** "Monday, September 21, 2026" in the given IANA timezone. */
export function formatZonedDate(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

/** "4:00 PM" in the given IANA timezone. */
export function formatZonedTime(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/** "4:00 PM – 5:00 PM" in the given IANA timezone. */
export function formatZonedTimeRange(startsAt: Date, endsAt: Date, timezone: string): string {
  return `${formatZonedTime(startsAt, timezone)} – ${formatZonedTime(endsAt, timezone)}`;
}
