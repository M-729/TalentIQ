// No date library exists in this project (see other src/lib/*.ts files) —
// this is deliberately dependency-free, using only Intl (already
// guaranteed by every supported browser/Node target).

/** The browser's own IANA timezone, used as the scheduling form's default. */
export function getBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// A curated fallback for engines that predate Intl.supportedValuesOf
// (Baseline-widely-available since 2023-ish, but not universal) — never
// hard-codes a single timezone (e.g. Beirut) as the only option.
const FALLBACK_TIME_ZONES = [
  "UTC",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Athens",
  "Asia/Beirut",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export function listTimeZones(): string[] {
  const supportedValuesOf = (
    Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] }
  ).supportedValuesOf;
  if (typeof supportedValuesOf === "function") {
    try {
      const zones = supportedValuesOf("timeZone");
      // "UTC" is a universally valid `timeZone` option value and this
      // module's own default fallback entry, but ECMA-402's
      // supportedValuesOf("timeZone") enumerates canonical IANA zone
      // names (e.g. "Etc/UTC") and doesn't reliably include the literal
      // "UTC" alias — add it explicitly rather than let it silently
      // disappear from the picker.
      return zones.includes("UTC") ? zones : ["UTC", ...zones];
    } catch {
      // fall through to the curated list
    }
  }
  return FALLBACK_TIME_ZONES;
}

function getPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): number {
  return Number(parts.find((part) => part.type === type)?.value ?? "0");
}

/**
 * Converts a wall-clock date + time, meant as local time IN the given IANA
 * timezone, to the correct UTC instant — WITHOUT any date library. This is
 * the standard Intl-only technique: interpret the wall-clock values as if
 * they were UTC (a first guess), ask Intl what that guessed instant
 * actually displays as when rendered in the target timezone, and use the
 * difference between "what we wanted" and "what we got" to correct the
 * guess. This correctly accounts for DST and non-whole-hour offsets
 * because Intl's `timeZone` option applies the real IANA tz database
 * built into the JS engine — never a hand-rolled UTC offset table (which
 * is exactly the kind of "manually apply timezone offsets incorrectly"
 * mistake this function exists to avoid).
 *
 * @param date "YYYY-MM-DD"
 * @param time "HH:mm"
 * @param timeZone a valid IANA identifier, e.g. "Asia/Beirut"
 */
export function zonedDateTimeToUtcIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);

  const guessUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(guessUtcMs));

  const displayedAsUtcMs = Date.UTC(
    getPart(parts, "year"),
    getPart(parts, "month") - 1,
    getPart(parts, "day"),
    getPart(parts, "hour"),
    getPart(parts, "minute"),
    getPart(parts, "second")
  );

  // The guess was off by exactly this much (the target zone's UTC offset
  // at this instant, including DST) — correcting by it yields the true
  // UTC instant for the intended wall-clock time.
  const correctedUtcMs = guessUtcMs + (guessUtcMs - displayedAsUtcMs);

  return new Date(correctedUtcMs).toISOString();
}

/** Splits an ISO instant into the "YYYY-MM-DD" / "HH:mm" wall-clock values it represents in the given IANA timezone — the inverse of zonedDateTimeToUtcIso, for pre-filling a reschedule form from an existing Interview. */
export function utcIsoToZonedDateTime(iso: string, timeZone: string): { date: string; time: string } {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = formatter.formatToParts(new Date(iso));
  const pad = (n: number) => String(n).padStart(2, "0");

  const year = getPart(parts, "year");
  const month = pad(getPart(parts, "month"));
  const day = pad(getPart(parts, "day"));
  const hour = pad(getPart(parts, "hour"));
  const minute = pad(getPart(parts, "minute"));

  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}
