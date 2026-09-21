import { formatZonedDate, formatZonedTime, formatZonedTimeRange, isValidIanaTimeZone } from "../src/utils/timezone";

describe("timezone formatting utilities", () => {
  describe("formatZonedDate", () => {
    it("formats a UTC instant as the correct local date for a positive-offset zone", () => {
      // 2026-09-21T10:00:00Z is still Sep 21 in Asia/Beirut (UTC+3 in September).
      expect(formatZonedDate(new Date("2026-09-21T10:00:00.000Z"), "Asia/Beirut")).toBe("Monday, September 21, 2026");
    });

    it("rolls over to the previous local day for an early-UTC instant in a positive-offset zone", () => {
      // 2026-09-21T01:00:00Z is still Sep 20 evening in America/Los_Angeles (UTC-7 in September).
      expect(formatZonedDate(new Date("2026-09-21T01:00:00.000Z"), "America/Los_Angeles")).toBe(
        "Sunday, September 20, 2026"
      );
    });
  });

  describe("formatZonedTime", () => {
    it("formats a UTC instant as the correct local time (UTC+3, no DST, Asia/Beirut)", () => {
      expect(formatZonedTime(new Date("2026-09-21T13:00:00.000Z"), "Asia/Beirut")).toBe("4:00 PM");
    });

    it("formats correctly during Northern-hemisphere summer DST (America/New_York, EDT = UTC-4)", () => {
      expect(formatZonedTime(new Date("2026-07-01T16:00:00.000Z"), "America/New_York")).toBe("12:00 PM");
    });

    it("formats correctly during Northern-hemisphere winter standard time (America/New_York, EST = UTC-5)", () => {
      expect(formatZonedTime(new Date("2026-01-15T16:00:00.000Z"), "America/New_York")).toBe("11:00 AM");
    });

    it("formats correctly right after a DST transition (America/New_York, 2026 spring-forward)", () => {
      // 2026-03-08T07:00:00Z is just after the US spring-forward transition
      // (2:00 AM EST -> 3:00 AM EDT on 2026-03-08) — EDT (UTC-4) applies.
      expect(formatZonedTime(new Date("2026-03-08T07:30:00.000Z"), "America/New_York")).toBe("3:30 AM");
    });
  });

  describe("formatZonedTimeRange", () => {
    it("formats a start–end range in the given timezone", () => {
      const startsAt = new Date("2026-09-21T13:00:00.000Z");
      const endsAt = new Date("2026-09-21T14:00:00.000Z");
      expect(formatZonedTimeRange(startsAt, endsAt, "Asia/Beirut")).toBe("4:00 PM – 5:00 PM");
    });

    it("never hard-codes Beirut — a different persisted timezone renders correctly", () => {
      const startsAt = new Date("2026-09-21T13:00:00.000Z");
      const endsAt = new Date("2026-09-21T14:00:00.000Z");
      expect(formatZonedTimeRange(startsAt, endsAt, "Europe/Berlin")).toBe("3:00 PM – 4:00 PM");
    });
  });

  describe("isValidIanaTimeZone (existing utility, unaffected)", () => {
    it("still accepts a real IANA zone", () => {
      expect(isValidIanaTimeZone("Europe/Berlin")).toBe(true);
    });

    it("still rejects a non-IANA value", () => {
      expect(isValidIanaTimeZone("PST")).toBe(false);
    });
  });
});
