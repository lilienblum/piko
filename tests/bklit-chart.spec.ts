import { expect, test } from "@playwright/test";
import type { QueryResult } from "../apps/dashboard/src/lib/api";

const api = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
let productId: string;
const first = Date.UTC(2026, 9, 31, 23);
const values = [10, null, 0, -20, -10, 5];
const fixture: QueryResult = {
  summary: {
    total: 6,
    actors: 0,
    visitors: 0,
    installations: 0,
    sessions: 0,
    session_views: 0,
    success_rate: null,
    avg_duration: 150,
    p95_duration: 200,
    value: -15,
  },
  series: values.map((value, index) => ({ time: first + index * 3_600_000, value })),
  groups: [],
  events: [],
  event_names: ["measurement"],
  page: 1,
  page_size: 15,
};

test.use({ timezoneId: "America/Los_Angeles", hasTouch: true });
test.beforeAll(async () => {
  const response = await fetch(`${api}/api/products`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify({ name: `Bklit rendering ${Date.now()}`, retention_days: 30 }),
  });
  expect(response.ok).toBe(true);
  productId = (await response.json()).id;
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), productId);
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  // Deliberately exercise edge-case numeric query results without changing stored analytics.
  await page.route("**/api/products/*/query", (route) => route.fulfill({ json: fixture }));
});

test("Bklit keeps numeric gaps and zero/negative values, with keyboard UTC inspection", async ({
  page,
}) => {
  await page.goto("/explore");
  const chart = page.locator('[data-chart-library="bklit"]');
  const line = chart.locator('path[stroke="var(--data)"][fill="transparent"]').first();
  await expect(line).toHaveAttribute("d", /^M/);
  const path = await line.getAttribute("d");
  expect(path?.match(/M/g)).toHaveLength(2); // Missing data starts a separate segment.
  expect(path).not.toMatch(/NaN|Infinity/);
  await expect(chart).toContainText("-20");
  await chart.press("Home");
  await expect(chart.locator(".chart-tooltip-date")).toContainText("Oct 31, 23:00 UTC");
  await expect(chart.locator(".chart-tooltip-value strong")).toHaveText("10");
  await chart.press("ArrowRight");
  await expect(chart.locator(".chart-tooltip-value strong")).toHaveText("No numeric value");
  await chart.press("ArrowRight");
  await expect(chart.locator(".chart-tooltip-value strong")).toHaveText("0");
  await chart.press("ArrowRight");
  await expect(chart.locator(".chart-tooltip-value strong")).toHaveText("-20");
  await expect(chart.locator('[aria-live="polite"]')).toContainText("Event count: -20");
  await chart.press("End");
  await expect(chart.locator(".chart-tooltip-value strong")).toHaveText("5");
  await chart.press("Escape");
  await expect(chart.locator(".chart-tooltip-content")).toHaveCount(0);
});

test("Bklit fits mobile with reduced motion and permits touch scrolling across the plot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await page.goto("/explore");
  const chart = page.locator('[data-chart-library="bklit"]');
  await expect(chart.locator("svg").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await chart.scrollIntoViewIfNeeded();
  const box = await chart.boundingBox();
  if (!box) throw new Error("Chart has no layout");
  const x = box.x + box.width / 2;
  const y = Math.min(box.y + box.height - 15, 800);
  const before = await page.evaluate(() => window.scrollY);
  const session = await page.context().newCDPSession(page);
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y }] });
  for (const delta of [30, 70, 110, 150]) {
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: y - delta }],
    });
  }
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before + 20);
  await session.detach();
  await page.screenshot({ path: test.info().outputPath("bklit-mobile-dark.png") });
});
