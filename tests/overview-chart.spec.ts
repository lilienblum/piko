import { expect, test, type Page, type Response } from "@playwright/test";
import type { Product, QueryResult } from "../apps/dashboard/src/lib/api";

const api = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
const products = {} as Record<"website" | "tool" | "generic" | "anonymous", Product>;
async function admin(path: string, body: unknown) {
  const response = await fetch(`${api}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
function chartResponse(page: Page, measure: string, bucket = "day") {
  return page.waitForResponse((response) => {
    if (!response.url().endsWith("/query") || response.request().method() !== "POST") return false;
    const body = response.request().postDataJSON();
    return body.page_size === 1 && body.measure === measure && body.bucket === bucket;
  });
}
async function result(response: Promise<Response>) {
  const value = await response;
  expect(value.ok()).toBe(true);
  return (await value.json()) as QueryResult;
}

test.beforeAll(async () => {
  const suffix = Date.now();
  const timestamp = new Date(Date.now() - 3600000).toISOString();
  for (const name of ["website", "tool", "generic", "anonymous"] as const) {
    const kind = name === "anonymous" ? "tool" : name;
    const product = await admin("/products", {
      name: `Chart ${name} ${suffix}`,
      kind,
      retention_days: 180,
    });
    products[name] = product;
    const { key } = await admin(`/products/${product.id}/keys`, { label: "Chart fixture" });
    const events =
      name === "website"
        ? [
            { actor_id: "shared", identity_kind: "visitor" },
            { actor_id: "shared", identity_kind: "visitor" },
            { actor_id: "second", identity_kind: "visitor" },
            { actor_id: "shared", identity_kind: "installation" },
            {},
            {},
          ].map((identity) => ({
            name: "page_view",
            ...identity,
            properties: { path: "/docs", referrer: "Direct" },
          }))
        : name === "tool"
          ? [
              {
                actor_id: "shared",
                identity_kind: "installation",
                properties: { duration_ms: 100 },
              },
              {
                actor_id: "shared",
                identity_kind: "installation",
                properties: { duration_ms: 300 },
              },
              {
                actor_id: "second",
                identity_kind: "installation",
                properties: { duration_ms: "900" },
              },
              { actor_id: "shared", identity_kind: "visitor", properties: { duration_ms: true } },
              { properties: { duration_ms: false } },
              { properties: {} },
            ].map((event) => ({
              name: "command_run",
              ...event,
              properties: { command: "build", ...event.properties },
            }))
          : name === "generic"
            ? ["visitor", "installation", "actor"].map((identity_kind) => ({
                name: "activity",
                actor_id: "shared",
                identity_kind,
                properties: {},
              }))
            : [{ name: "command_run", properties: { duration_ms: "100", command: "build" } }];
    const response = await fetch(`${api}/api/ingest`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        events: events.map((event) => ({
          event_id: crypto.randomUUID(),
          timestamp,
          source: "sdk",
          ...event,
        })),
      }),
    });
    expect(response.ok).toBe(true);
  }
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), products.website.id);
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
});

test("visitor chart excludes installation identities without shrinking overview totals", async ({
  page,
}) => {
  const queries: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/query")) queries.push(request.postDataJSON());
  });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
  await expect(page.locator(".metric-value").first()).toHaveText("6");
  expect(new Set(queries.map((query) => JSON.stringify(query))).size).toBe(2);
  const visitors = chartResponse(page, "actors");
  await select(page, "Chart metric", "Unique visitors");
  const daily = await result(visitors);
  expect(daily.summary.value).toBe(2);
  expect(Math.max(...daily.series.map((point) => point.value ?? 0))).toBe(2);
  expect((await visitors).request().postDataJSON()).toMatchObject({
    identity_kind: "visitor",
    event: "page_view",
    page_size: 1,
  });
  await expect(page.locator(".metric-value").first()).toHaveText("6");
  await expect(page.locator(".breakdowns .breakdown-value").first()).toHaveText("6");
  const hourly = chartResponse(page, "actors", "hour");
  await select(page, "Chart interval", "Hourly");
  expect((await result(hourly)).summary.value).toBe(2);
  await expect(page.getByText("Visitors counted once per hour.")).toBeVisible();
  await expect(page.locator(".chart-period-note")).toContainText("Last hour is partial");
  const wider = chartResponse(page, "actors");
  await select(page, "Date range", "Last 90 days");
  await result(wider);
  await expect(page.getByRole("combobox", { name: "Chart interval" })).toContainText("Daily");
  await page.getByRole("combobox", { name: "Chart interval" }).click();
  await expect(page.getByRole("option", { name: "Hourly", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("CLI duration aggregates ignore strings and booleans, and product switches reset chart choices", async ({
  page,
}) => {
  await page.goto("/");
  await select(page, "Select project", products.tool.name);
  await expect(page.locator(".metric-value").first()).toHaveText("6");
  const average = chartResponse(page, "avg");
  await select(page, "Chart metric", "Average duration");
  expect((await result(average)).summary.value).toBe(200);
  expect((await average).request().postDataJSON()).toMatchObject({
    event: "command_run",
    property: "duration_ms",
  });
  const p95 = chartResponse(page, "p95");
  await select(page, "Chart metric", "p95 duration");
  expect((await result(p95)).summary.value).toBe(290);
  const installations = chartResponse(page, "actors");
  await select(page, "Chart metric", "Active installations");
  expect((await result(installations)).summary.value).toBe(2);
  expect((await installations).request().postDataJSON().identity_kind).toBe("installation");
  await expect(page.locator(".metric-value").first()).toHaveText("6");
  await select(page, "Select project", products.generic.name);
  await expect(page.getByRole("combobox", { name: "Chart metric" })).toContainText("Events");
  const actors = chartResponse(page, "actors");
  await select(page, "Chart metric", "Identified actors");
  expect((await result(actors)).summary.value).toBe(3);
  expect((await actors).request().postDataJSON().identity_kind).toBeUndefined();
});

test("selection loading stays inside the chart and failed refresh keeps the existing plot", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".metric-value").first()).toHaveText("6");
  const chart = await page.locator(".chart-card").elementHandle();
  const bounds = await page.locator(".chart-card").boundingBox();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let hold = true;
  let fail = false;
  await page.route("**/api/products/*/query", async (route) => {
    if (route.request().postDataJSON().page_size !== 1) return route.continue();
    if (hold) await gate;
    if (fail) {
      fail = false;
      return route.fulfill({ status: 503, json: { error: "Chart temporarily unavailable" } });
    }
    return route.continue();
  });
  try {
    await select(page, "Chart metric", "Unique visitors");
    await expect(page.getByRole("status", { name: "Loading chart", exact: true })).toBeVisible();
    await expect(page.locator(".chart-card [data-slot='chart']")).toHaveCount(0);
    await expect(page.locator(".metric-value").first()).toHaveText("6");
    expect(await chart?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.locator(".chart-card").boundingBox()).toEqual(bounds);
  } finally {
    hold = false;
    release();
  }
  await expect(page.locator(".chart-card [data-slot='chart']")).toBeVisible();
  const plot = await page.locator(".chart-card [data-slot='chart']").elementHandle();
  fail = true;
  await page.getByRole("button", { name: "Refresh analytics" }).click();
  await expect(page.getByRole("alert")).toContainText("Chart temporarily unavailable");
  expect(await plot?.evaluate((element) => element.isConnected)).toBe(true);
  expect(await page.locator(".chart-card").boundingBox()).toEqual(bounds);
  const retried = chartResponse(page, "actors");
  await page.getByRole("button", { name: "Retry chart", exact: true }).click();
  await result(retried);
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("anonymous CLI data has honest empty states and narrow duration axes remain visible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await select(page, "Select project", products.anonymous.name);
  await select(page, "Chart metric", "Active installations");
  await expect(
    page.getByText("No installation IDs received in this range.", { exact: true }),
  ).toBeVisible();
  await select(page, "Chart metric", "Average duration");
  await expect(
    page.getByText("No numeric durations received in this range.", { exact: true }),
  ).toBeVisible();
  await select(page, "Select project", products.tool.name);
  await select(page, "Chart metric", "p95 duration");
  await expect(page.locator(".chart-card [data-slot='chart']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator(".series-chart .recharts-area-dot")).toHaveCount(1);
  const ticks = await page.locator(".series-chart text").evaluateAll((elements) =>
    elements
      .filter((element) => element.textContent?.endsWith(" ms"))
      .map((element) => {
        const svg = element.closest("svg");
        if (!svg) throw new Error("Expected axis tick inside chart SVG");
        return {
          left: element.getBoundingClientRect().left,
          plotLeft: svg.getBoundingClientRect().left,
        };
      }),
  );
  expect(ticks.length).toBeGreaterThan(0);
  for (const tick of ticks) expect(tick.left).toBeGreaterThanOrEqual(tick.plotLeft);
  await page.screenshot({ path: test.info().outputPath("cli-chart-mobile.png") });
});
