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
    // The client retries advertised query-capacity responses; observe the completed attempt.
    if (response.status() === 503 && response.headers()["retry-after"]) return false;
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
    const product = await admin("/products", {
      name: `Chart ${name} ${suffix}`,

      retention_days: 180,
    });
    products[name] = product;
    if (name === "website")
      await admin(`/products/${product.id}/sources`, { name: "Unused mobile source" });
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
  await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("6");
  expect(new Set(queries.map((query) => JSON.stringify(query))).size).toBe(2);
  const visitors = chartResponse(page, "actors");
  await select(page, "Chart metric", "Unique visitors");
  const daily = await result(visitors);
  expect(daily.summary.value).toBe(2);
  expect(Math.max(...daily.series.map((point) => point.value ?? 0))).toBe(2);
  expect((await visitors).request().postDataJSON()).toMatchObject({
    identity_kind: "visitor",
    page_size: 1,
  });
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("2");
  await expect(page.locator(".breakdowns .breakdown-value").first()).toHaveText("6");
  const hourly = chartResponse(page, "actors", "hour");
  await page.getByRole("button", { name: "Hourly", exact: true }).click();
  expect((await result(hourly)).summary.value).toBe(2);
  await expect(
    page.locator('.activity-widget svg[aria-label="Unique visitors by UTC hour"]'),
  ).toBeVisible();
  await expect(page.locator(".chart-period-note")).toContainText("Last hour is partial");
  const wider = chartResponse(page, "actors");
  await page.getByRole("button", { name: "Last 90 days", exact: true }).click();
  await result(wider);
  await expect(page.getByRole("button", { name: "Daily", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Hourly", exact: true })).toBeDisabled();
});

test("CLI duration aggregates ignore strings and booleans, and product switches reset chart choices", async ({
  page,
}) => {
  await page.goto("/");
  await select(page, "Select project", products.tool.name);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("6");
  const average = chartResponse(page, "avg");
  await select(page, "Chart metric", "Average duration");
  expect((await result(average)).summary.value).toBe(200);
  expect((await average).request().postDataJSON()).toMatchObject({
    property: "duration_ms",
  });
  const p95 = chartResponse(page, "p95");
  await select(page, "Chart metric", "p95 duration");
  expect((await result(p95)).summary.value).toBe(290);
  const installations = chartResponse(page, "actors");
  await select(page, "Chart metric", "Active installations");
  expect((await result(installations)).summary.value).toBe(2);
  expect((await installations).request().postDataJSON().identity_kind).toBe("installation");
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("2");
  await expect(page.locator(".breakdown-widget footer")).toContainText("6 events");
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
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("6");
  const chart = await page.locator(".activity-widget").elementHandle();
  const bounds = await page.locator(".activity-widget").boundingBox();
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
    await expect(page.locator(".activity-widget [data-slot='chart']")).toHaveCount(0);
    await expect(page.locator(".breakdown-widget footer")).toContainText("6 events");
    expect(await chart?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.locator(".activity-widget").boundingBox()).toEqual(bounds);
  } finally {
    hold = false;
    release();
  }
  await expect(page.locator(".activity-widget [data-slot='chart']")).toBeVisible();
  const plot = await page.locator(".activity-widget [data-slot='chart']").elementHandle();
  fail = true;
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.getByRole("alert")).toContainText("Chart temporarily unavailable");
  expect(await plot?.evaluate((element) => element.isConnected)).toBe(true);
  expect(await page.locator(".activity-widget").boundingBox()).toEqual(bounds);
  const retried = chartResponse(page, "actors");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
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
    page
      .locator(".activity-widget")
      .getByText("No numeric durations received in this range.", { exact: true }),
  ).toBeVisible();
  await select(page, "Select project", products.tool.name);
  await select(page, "Chart metric", "p95 duration");
  await expect(page.locator(".activity-widget [data-slot='chart']")).toBeVisible();
  await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.locator('.activity-widget .analytics-plot svg circle[r="2.5"]')).toHaveCount(1);
  const ticks = await page
    .locator(".activity-widget .analytics-plot svg text")
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.textContent?.endsWith(" ms"))
        .map((element) => {
          const svg = element.closest(".activity-widget .analytics-plot");
          if (!svg) throw new Error("Expected axis tick inside chart");
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

test("calendar interval buttons query raw weekly and monthly aggregates and retain selection", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
  const weekly = chartResponse(page, "count", "week");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  const weeks = await result(weekly);
  expect(weeks.series.every((point) => new Date(point.time).getUTCDay() === 1)).toBe(true);
  expect(weeks.series.reduce((sum, point) => sum + (point.value ?? 0), 0)).toBe(6);
  await expect(page.locator(".chart-period-note")).toContainText("Monday start");
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await expect(page.getByRole("button", { name: "Weekly", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await select(page, "Select project", products.tool.name);
  const p95 = chartResponse(page, "p95");
  await select(page, "Chart metric", "p95 duration");
  await result(p95);
  const monthly = chartResponse(page, "p95", "month");
  await page.getByRole("button", { name: "Monthly", exact: true }).click();
  const months = await result(monthly);
  expect(months.series.every((point) => new Date(point.time).getUTCDate() === 1)).toBe(true);
  expect(months.summary.value).toBe(290);
  expect(months.series.find((point) => point.value !== null)?.value).toBe(290);
  const group = page.getByRole("group", { name: "Chart interval" });
  await group.getByRole("button", { name: "Monthly" }).press("ArrowLeft");
  await expect(group.getByRole("button", { name: "Weekly" })).toBeFocused();
  const keyboard = chartResponse(page, "p95", "week");
  await page.keyboard.press("Space");
  await result(keyboard);
  await expect(group.getByRole("button", { name: "Weekly" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

for (const width of [1440, 894, 390]) {
  test(`Overview keeps six square widgets and contained content at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator(".overview-widget")).toHaveCount(6);
    const bounds = await page.locator(".overview-widget").evaluateAll((widgets) =>
      widgets.map((widget) => {
        const rect = widget.getBoundingClientRect();
        const body = widget.querySelector(".widget-body")?.getBoundingClientRect();
        const footer = widget.querySelector(".widget-footer")?.getBoundingClientRect();
        if (!body || !footer) throw new Error("Widget structure missing");
        return {
          width: rect.width,
          height: rect.height,
          bodyBottom: body.bottom,
          footerTop: footer.top,
        };
      }),
    );
    for (const bound of bounds) {
      expect(Math.abs(bound.width - bound.height)).toBeLessThan(2);
      expect(bound.bodyBottom).toBeLessThanOrEqual(bound.footerTop);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await expect(page.locator(".outcomes-widget [data-chart-kind='donut']")).toHaveCount(0);
    await expect(page.locator(".outcomes-widget")).toContainText("No success values received");
    await expect(page.locator(".audience-widget .widget-value")).toHaveText("3");
    const sources = page.locator(".sources-widget");
    await expect(sources.locator("[data-chart-kind='donut']")).toHaveCount(0);
    await expect(sources.locator(".widget-value")).toHaveText("6");
    await expect(sources).not.toContainText("100%");
    await expect(sources.getByRole("link", { name: "Explore Events", exact: true })).toBeVisible();
    await expect(sources.locator("footer")).toContainText(
      "All matching events come from this source.",
    );
  });
}

test("duration widget switches to the server p95 without treating missing or string durations as zero", async ({
  page,
}) => {
  await page.goto("/");
  await select(page, "Select project", products.tool.name);
  const widget = page.locator(".duration-widget");
  await expect(widget.locator(".widget-value")).toHaveText("200 ms");
  const p95 = chartResponse(page, "p95");
  await widget.getByRole("button", { name: "p95", exact: true }).click();
  expect((await result(p95)).summary.value).toBe(290);
  await expect(widget.locator(".widget-value")).toHaveText("290 ms");
  await expect(widget.locator(".series-chart")).toBeVisible();
  await select(page, "Select project", products.anonymous.name);
  await expect(widget.locator(".widget-value")).toHaveText("—");
  await expect(widget.locator(".series-chart")).toHaveCount(0);
});
