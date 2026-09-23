import type { AnalyticsRange } from "@/types/hiringAnalytics";

/** "period" is always "YYYY-MM-DD" — a day, a week's Monday, or a month's 1st, depending on the selected range (see hiringAnalytics.service.ts's getApplicationsOverTime). Formatted per that same granularity so an axis/tooltip label never implies more precision than the bucket actually has. */
export function formatPeriodLabel(period: string, range: AnalyticsRange): string {
  const date = new Date(`${period}T00:00:00.000Z`);
  if (range === "all") {
    return date.toLocaleDateString(undefined, { timeZone: "UTC", month: "short", year: "numeric" });
  }
  return date.toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric" });
}
