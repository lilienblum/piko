import { expect, test } from "bun:test";
import {
  calendarDays,
  parseDay,
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
