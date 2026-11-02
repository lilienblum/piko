import { expect, test } from "bun:test";
import {
  calendarDays,
  parseDay,
  presetRange,
  rangeError,
  rangeFromDays,
  rangeLabel,
} from "../apps/dashboard/src/lib/date-range";

test("calendar ranges include both days and use exclusive UTC API endpoints", () => {
  expect(rangeFromDays("2026-03-08", "2026-03-08")).toEqual({
    from: "2026-03-08T00:00:00.000Z",
    to: "2026-03-09T00:00:00.000Z",
  });
  const crossYear = rangeFromDays("2025-12-31", "2026-01-02");
  expect(crossYear.to).toBe("2026-01-03T00:00:00.000Z");
  expect(calendarDays(crossYear)).toEqual({ start: "2025-12-31", end: "2026-01-02" });
  expect(rangeLabel(crossYear)).toContain("2025");
  expect(rangeLabel(crossYear)).toContain("2026");
  expect(
    calendarDays({ from: "2026-01-01T00:00:00.000Z", to: "2026-01-03T08:00:00.000Z" }).end,
  ).toBe("2026-01-03");
});
test("date inputs reject rollovers, future days, reversed and oversized ranges", () => {
  expect(parseDay("2026-02-30")).toBeUndefined();
  expect(parseDay("2026-1-2")).toBeUndefined();
  expect(parseDay("2024-02-29")?.toISOString()).toBe("2024-02-29T00:00:00.000Z");
  const today = "2026-11-02";
  expect(rangeError("2026-11-02", "2026-11-01", today)).toContain("on or after");
  expect(rangeError("2026-11-02", "2026-11-03", today)).toContain("before today");
  expect(rangeError("1969-12-31", "1970-01-01", today)).toContain("1970");
  expect(rangeError("2024-01-01", "2024-12-31", today)).toBeUndefined();
  expect(rangeError("2024-01-01", "2025-01-01", today)).toContain("366");
});

test("relative periods and arrows respect UTC calendar boundaries", async () => {
  const { presetRange, shiftRange } = await import("../apps/dashboard/src/lib/date-range");
  const now = Date.parse("2024-03-15T12:00:00.000Z");
  expect(presetRange("today", now)).toEqual({
    from: "2024-03-15T00:00:00.000Z",
    to: "2024-03-15T12:00:00.000Z",
  });
  expect(presetRange("yesterday", now)).toEqual(rangeFromDays("2024-03-14", "2024-03-14"));
  expect(presetRange("last-month", now)).toEqual(rangeFromDays("2024-02-01", "2024-02-29"));
  expect(presetRange("year", now).from).toBe("2024-01-01T00:00:00.000Z");
  expect(presetRange("12months", now).from).toBe("2023-04-01T00:00:00.000Z");
  const february = shiftRange(presetRange("month", now), -1, now, "month");
  expect(february).toEqual(rangeFromDays("2024-02-01", "2024-02-29"));
  if (!february) throw new Error("Missing previous month");
  expect(shiftRange(february, 1, now)).toEqual(presetRange("month", now));
  expect(shiftRange(presetRange("today", now), 1, now, "today")).toBeUndefined();
  expect(shiftRange(presetRange("year", now), 1, now, "year")).toBeUndefined();
  expect(shiftRange(rangeFromDays("2024-03-01", "2024-03-03"), 1, now)).toEqual(
    rangeFromDays("2024-03-04", "2024-03-06"),
  );
  expect(shiftRange(rangeFromDays("2024-03-12", "2024-03-14"), 1, now)).toBeUndefined();
  expect(shiftRange(rangeFromDays("1970-01-01", "1970-01-01"), -1, now)).toBeUndefined();
});

test("calendar presets remain nonempty at the exact start of a day or year", () => {
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  for (const period of ["today", "month", "year"] as const) {
    const range = presetRange(period, now);
    expect(Date.parse(range.to) - Date.parse(range.from)).toBe(1);
    expect(rangeLabel(range)).toBe("Jan 1, 2026");
  }
});

test("last 24 hours is a rolling day, not midnight-to-now", () => {
  const now = Date.parse("2026-03-09T03:15:27.123Z");
  expect(presetRange("24h", now)).toEqual({
    from: "2026-03-08T03:15:27.123Z",
    to: "2026-03-09T03:15:27.123Z",
  });
  expect(presetRange("today", now).from).toBe("2026-03-09T00:00:00.000Z");
});
