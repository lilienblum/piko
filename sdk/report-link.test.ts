import { expect, test } from "bun:test";
import { reportLink } from "../apps/dashboard/src/lib/report-link";

test("report links only open validated page or referring-site destinations", () => {
  expect(reportLink("property:path", "/docs", "https://example.com/app")).toBe(
    "https://example.com/docs",
  );
  expect(reportLink("property:referrer", "docs.example.com")).toBe("https://docs.example.com/");
  expect(reportLink("property:referrer", "https://example.com/docs")).toBe(
    "https://example.com/docs",
  );
  for (const value of [
    "javascript:alert(1)",
    "data:text/html,test",
    "https://user:password@example.com",
    "Direct",
    "https://evil.com\n.test",
    "https://example.com/\u0000test",
  ])
    expect(reportLink("property:referrer", value)).toBeUndefined();
  for (const value of ["//evil.com", "/\\evil.com", "https://evil.com", null, 10])
    expect(reportLink("property:path", value, "https://example.com")).toBeUndefined();
  expect(reportLink("property:path", "/docs")).toBeUndefined();
  expect(reportLink("name", "https://example.com")).toBeUndefined();
});
