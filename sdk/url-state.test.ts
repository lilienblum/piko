import { expect, test } from "bun:test";
import {
  validateWorkspaceSearch,
  validateOverviewSearch,
} from "../apps/dashboard/src/lib/workspace-search";
import { defaultSpec, validateExploreSearch } from "../apps/dashboard/src/lib/explore-search";

test("workspace links accept stable slugs and fixed UTC endpoints, and reject ambiguous scope", () => {
  const link = {
    project: "orbit-2",
    source: "all",
    days: 7,
    snapshot: "2026-11-02T08:00:00.000Z",
  } as const;
  expect(validateWorkspaceSearch(link)).toEqual(link);
  for (const patch of [
    { project: "../../orbit" },
    { source: "missing" },
    { days: 0 },
    { days: [7] },
    { snapshot: "yesterday" },
    { snapshot: "-271821-04-20T00:00:00.000Z" },
  ])
    expect(validateWorkspaceSearch({ ...link, ...patch }).invalidWorkspace).toBe(true);
  expect(validateWorkspaceSearch({ ...link, snapshot: "yesterday" }).snapshot).toBeUndefined();
  expect(validateWorkspaceSearch({ productId: "unvalidated", admin: true })).toEqual({
    project: undefined,
    source: undefined,
    days: undefined,
    snapshot: undefined,
    from: undefined,
    to: undefined,
  });
});
test("Explore URL validation preserves typed filter text and bounded pagination", () => {
  for (const value of ["true", "42", '"42"', '"build"']) {
    const parsed = validateExploreSearch({
      query: { measure: "avg", filterProperty: "success", filterValue: value },
      page: 2,
      pageSize: 30,
    });
    expect(parsed.query).toEqual({
      ...defaultSpec,
      measure: "avg",
      filterProperty: "success",
      filterValue: value,
    });
    expect(parsed.page).toBe(2);
    expect(parsed.pageSize).toBe(30);
  }
  for (const search of [
    { page: -1 },
    { page: 10002 },
    { pageSize: 1000 },
    { query: { measure: "sql" } },
    { query: { filterProperty: "x' OR true" } },
    { query: { filterValue: "x".repeat(2049) } },
  ])
    expect(validateExploreSearch(search).invalidQuery).toBe(true);
});
test("Overview choices are allowlisted before driving API queries", () => {
  expect(
    validateOverviewSearch({
      metric: "p95",
      interval: "week",
      breakdown: "property:command",
      duration: "p95",
    }),
  ).toEqual({ metric: "p95", breakdown: "property:command", duration: "p95" });
  expect(validateOverviewSearch({ interval: "hour" })).not.toHaveProperty("interval");
  expect(validateOverviewSearch({ metric: "sql", interval: "forever" })).toEqual({
    metric: undefined,
    breakdown: undefined,
    duration: undefined,
  });
});

test("custom URL ranges require a complete, ordered UTC pair within the query limit", () => {
  const range = { from: "2024-01-01T00:00:00.000Z", to: "2025-01-01T00:00:00.000Z" };
  expect(validateWorkspaceSearch(range)).toMatchObject(range);
  for (const patch of [
    { to: undefined },
    { from: undefined },
    { to: range.from },
    { from: range.to, to: range.from },
    { to: "2025-01-02T00:00:00.000Z" },
    { from: "2024-01-01" },
    { from: "2024-01-01T01:00:00.000+01:00" },
    { snapshot: "2024-01-02T00:00:00.000Z" },
  ])
    expect(validateWorkspaceSearch({ ...range, ...patch }).invalidWorkspace).toBe(true);
});

test("overview filters preserve primitive types and reject malformed links", () => {
  for (const value of [true, 12.5, "12.5"])
    expect(
      validateOverviewSearch({ filter: { field: "property:amount", value } }).filter?.value,
    ).toBe(value);
  for (const filter of [
    null,
    [],
    { field: "sql", value: "test" },
    { field: "name", value: true },
    { field: "property:amount", value: { secret: 1 } },
    { field: "property:amount", value: Infinity },
  ])
    expect(validateOverviewSearch({ filter }).invalidFilter).toBe(true);
});
