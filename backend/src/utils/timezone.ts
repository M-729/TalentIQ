// Computed once at module load (Node/V8's ICU data), not per call — this
// is a fixed ~400-entry list, so a Set lookup is both cheap and exact
// (matches only real IANA identifiers, e.g. rejects "PST" or "GMT+3"
// which are not valid `timeZone` values for Intl/date libraries downstream).
const VALID_IANA_TIME_ZONES = new Set(Intl.supportedValuesOf("timeZone"));

export function isValidIanaTimeZone(timezone: string): boolean {
  return VALID_IANA_TIME_ZONES.has(timezone);
}
