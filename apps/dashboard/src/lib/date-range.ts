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

export const periodLabels = {
  today: "Today",
  "24h": "Last 24 hours",
  yesterday: "Yesterday",
  month: "Month to date",
  "last-month": "Last month",
  year: "Year to date",
  "12months": "Last 12 months",
} as const;
export type DatePeriod = keyof typeof periodLabels;
export type DatePreset = 7 | 30 | 90 | DatePeriod;

export function presetRange(period: DatePeriod, now: number): AnalyticsRange {
  const end = new Date(now);
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  if (period === "24h") {
    start.setTime(now - DAY_MS);
  } else if (period === "yesterday") {
    end.setTime(start.getTime());
    start.setUTCDate(start.getUTCDate() - 1);
  } else if (period === "month" || period === "last-month" || period === "12months") {
    start.setUTCDate(1);
    if (period === "last-month") {
      end.setTime(start.getTime());
      start.setUTCMonth(start.getUTCMonth() - 1);
    } else if (period === "12months") start.setUTCMonth(start.getUTCMonth() - 11);
  } else if (period === "year") start.setUTCMonth(0, 1);
  return {
    from: start.toISOString(),
    to: new Date(Math.max(end.getTime(), start.getTime() + 1)).toISOString(),
  };
}

export function rangeStep(
  range: AnalyticsRange,
  period?: DatePeriod,
): "day" | "month" | "year" | "span" {
  const start = new Date(range.from);
  const end = new Date(range.to);
  const fullDays = start.getTime() % DAY_MS === 0 && end.getTime() % DAY_MS === 0;
  if (
    period === "year" ||
    (fullDays &&
      start.getUTCMonth() === 0 &&
      end.getUTCMonth() === 0 &&
      start.getUTCDate() === 1 &&
      end.getUTCDate() === 1 &&
      end.getUTCFullYear() - start.getUTCFullYear() === 1)
  )
    return "year";
  if (
    period === "month" ||
    period === "last-month" ||
    (fullDays &&
      start.getUTCDate() === 1 &&
      end.getUTCDate() === 1 &&
      end.getUTCFullYear() * 12 +
        end.getUTCMonth() -
        start.getUTCFullYear() * 12 -
        start.getUTCMonth() ===
        1)
  )
    return "month";
  if (
    period === "today" ||
    period === "yesterday" ||
    Date.parse(range.to) - Date.parse(range.from) <= DAY_MS
  )
    return "day";
  return "span";
}

export function shiftRange(
  range: AnalyticsRange,
  direction: -1 | 1,
  now: number,
  period?: DatePeriod,
): AnalyticsRange | undefined {
  const step = rangeStep(range, period);
  const start = new Date(`${calendarDays(range).start}T00:00:00.000Z`);
  const end = new Date(start);
  if (step === "month") {
    start.setUTCDate(1);
    start.setUTCMonth(start.getUTCMonth() + direction);
    end.setTime(start.getTime());
    end.setUTCMonth(end.getUTCMonth() + 1);
  } else if (step === "year") {
    start.setUTCMonth(0, 1);
    start.setUTCFullYear(start.getUTCFullYear() + direction);
    end.setTime(start.getTime());
    end.setUTCFullYear(end.getUTCFullYear() + 1);
  } else {
    const days = step === "day" ? 1 : Math.ceil((Date.parse(range.to) - start.getTime()) / DAY_MS);
    start.setUTCDate(start.getUTCDate() + direction * days);
    end.setTime(start.getTime() + days * DAY_MS);
  }
  if (start.getTime() < 0 || start.getTime() > now) return;
  const tomorrow = Math.floor(now / DAY_MS) * DAY_MS + DAY_MS;
  if (step === "span" && end.getTime() > tomorrow) return;
  return { from: start.toISOString(), to: new Date(Math.min(end.getTime(), now)).toISOString() };
}
