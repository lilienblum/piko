export const DAY_MS = 86_400_000;
export const MAX_RANGE_DAYS = 366;
export type AnalyticsRange = { from: string; to: string };

export function parseDay(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return;
  return date;
}

/** Calendar endpoints are inclusive; API endpoints are UTC and end-exclusive. */
export function calendarDays(range: AnalyticsRange) {
  return {
    start: range.from.slice(0, 10),
    end: new Date(Date.parse(range.to) - 1).toISOString().slice(0, 10),
  };
}

export function rangeError(
  start: string,
  end: string,
  today = new Date().toISOString().slice(0, 10),
) {
  const from = parseDay(start);
  const through = parseDay(end);
  if (!from || !through) return "Enter valid dates as YYYY-MM-DD.";
  if (start < "1970-01-01") return "Choose a start date on or after January 1, 1970.";
  if (end < start) return "End date must be on or after start date.";
  if (end > today) return "Choose an end date on or before today.";
  if ((through.getTime() - from.getTime()) / DAY_MS + 1 > MAX_RANGE_DAYS)
    return "Choose a range of 366 days or fewer.";
}

export function rangeFromDays(start: string, end: string): AnalyticsRange {
  const from = parseDay(start);
  const through = parseDay(end);
  if (!from || !through) throw new Error("Invalid calendar dates");
  return { from: from.toISOString(), to: new Date(through.getTime() + DAY_MS).toISOString() };
}

const dateFormat = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});
export function rangeLabel(range: AnalyticsRange) {
  return dateFormat.formatRange(new Date(range.from), new Date(Date.parse(range.to) - 1));
}
