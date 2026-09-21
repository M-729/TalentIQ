import { describe, expect, it } from "vitest";
import { getBrowserTimeZone, listTimeZones, utcIsoToZonedDateTime, zonedDateTimeToUtcIso } from "@/lib/timezone";

describe("zonedDateTimeToUtcIso", () => {
  it("treats UTC as itself", () => {
    expect(zonedDateTimeToUtcIso("2024-06-15", "12:00", "UTC")).toBe("2024-06-15T12:00:00.000Z");
  });

  it("converts a fixed-offset zone with no DST (Asia/Tokyo, UTC+9)", () => {
    expect(zonedDateTimeToUtcIso("2024-06-15", "12:00", "Asia/Tokyo")).toBe("2024-06-15T03:00:00.000Z");
  });

  it("correctly applies summer DST offset (America/New_York, EDT = UTC-4)", () => {
    expect(zonedDateTimeToUtcIso("2024-06-15", "12:00", "America/New_York")).toBe("2024-06-15T16:00:00.000Z");
  });

  it("correctly applies winter standard-time offset (America/New_York, EST = UTC-5)", () => {
    expect(zonedDateTimeToUtcIso("2024-01-15", "12:00", "America/New_York")).toBe("2024-01-15T17:00:00.000Z");
  });

  it("handles a half-hour offset zone (Asia/Kolkata, UTC+5:30)", () => {
    expect(zonedDateTimeToUtcIso("2024-06-15", "12:00", "Asia/Kolkata")).toBe("2024-06-15T06:30:00.000Z");
  });

  it("rolls over to the previous UTC day when the local time is early morning in a positive-offset zone", () => {
    expect(zonedDateTimeToUtcIso("2024-06-15", "01:00", "Asia/Tokyo")).toBe("2024-06-14T16:00:00.000Z");
  });
});

describe("utcIsoToZonedDateTime", () => {
  it("is the inverse of zonedDateTimeToUtcIso for a DST-affected zone", () => {
    const iso = zonedDateTimeToUtcIso("2024-06-15", "14:30", "America/New_York");
    expect(utcIsoToZonedDateTime(iso, "America/New_York")).toEqual({ date: "2024-06-15", time: "14:30" });
  });

  it("is the inverse across a UTC day-boundary rollover", () => {
    const iso = zonedDateTimeToUtcIso("2024-06-15", "01:00", "Asia/Tokyo");
    expect(utcIsoToZonedDateTime(iso, "Asia/Tokyo")).toEqual({ date: "2024-06-15", time: "01:00" });
  });
});

describe("getBrowserTimeZone", () => {
  it("returns a non-empty IANA-looking string", () => {
    const tz = getBrowserTimeZone();
    expect(typeof tz).toBe("string");
    expect(tz.length).toBeGreaterThan(0);
  });
});

describe("listTimeZones", () => {
  it("includes well-known IANA zones", () => {
    const zones = listTimeZones();
    expect(zones).toContain("UTC");
    expect(zones.length).toBeGreaterThan(5);
  });
});
