import { expect, test } from "bun:test";
import { sourceDistribution } from "../apps/dashboard/src/lib/overview-widgets";

test("source donut includes the API's unreturned tail without inflating top sources", () => {
  const slices = sourceDistribution(
    [
      { label: "web", display: "Website", value: 40, count: 40 },
      { label: "cli", display: "CLI", value: 25, count: 25 },
      { label: "ios", display: "iOS", value: 15, count: 15 },
      { label: "android", display: "Android", value: 10, count: 10 },
    ],
    100,
  );
  expect(slices.map(({ label, value }) => ({ label, value }))).toEqual([
    { label: "Website", value: 40 },
    { label: "CLI", value: 25 },
    { label: "iOS", value: 15 },
    { label: "Other sources", value: 20 },
  ]);
  expect(slices.reduce((sum, slice) => sum + slice.value, 0)).toBe(100);
  expect(slices[0].group?.label).toBe("web");
  expect(slices[3].group).toBeUndefined();
});

test("empty and single-source ranges do not fabricate slices", () => {
  expect(sourceDistribution([], 0)).toEqual([]);
  expect(sourceDistribution([{ label: "web", count: 5, value: 5 }], 5)).toHaveLength(1);
  expect(sourceDistribution([{ label: "web", count: 0, value: 0 }], 0)).toEqual([]);
});
