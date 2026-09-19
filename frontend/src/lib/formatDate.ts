// "Sep 19, 2026 · 2:15 PM" — date-only formatting elsewhere in the app
// (see JobsTable.tsx) omits time; screenings need the time too since HR
// may run several in one day.
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const datePart = date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}
