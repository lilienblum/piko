import { expect, test } from "bun:test";
import { displayTimestamp, validTimeZone } from "../apps/dashboard/src/lib/display-time";

test("event display converts across date boundaries without changing the instant", () => {
  const timestamp = Date.parse("2026-11-01T00:30:00Z");
  expect(displayTimestamp(timestamp, "Asia/Tokyo")).toMatch(/^01 Nov 2026(?:,| at) 09:30:00.000$/);
  expect(displayTimestamp(timestamp, "America/Los_Angeles")).toMatch(
    /^31 Oct 2026(?:,| at) 17:30:00.000$/,
  );
  expect(displayTimestamp(timestamp, "UTC")).toBe("2026-11-01T00:30:00.000Z");
});
test("display follows DST and rejects invalid saved preferences", () => {
  expect(displayTimestamp(Date.parse("2026-11-01T09:30:00Z"), "America/Los_Angeles")).toMatch(
    /^01 Nov 2026(?:,| at) 01:30:00.000$/,
  );
  expect(validTimeZone("Asia/Tokyo")).toBe("Asia/Tokyo");
  expect(validTimeZone("not/a-zone")).toBe("UTC");
  expect(validTimeZone(null)).toBe("UTC");
});
