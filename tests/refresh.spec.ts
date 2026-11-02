import { expect, test, type Page } from "@playwright/test";

const api = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
let product: { id: string; name: string };
async function admin(path: string, body: unknown) {
  const response = await fetch(`${api}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function holdQuery(page: Page) {
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/products/*/query", async (route) => {
    await gate;
    await route.continue();
  });
  return release;
}
test.beforeAll(async () => {
  product = await admin("/products", {
    name: `Refresh ${Date.now()}`,

    retention_days: 30,
  });
  const { key } = await admin(`/products/${product.id}/keys`, { label: "Refresh regression" });
  const response = await fetch(`${api}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      events: Array.from({ length: 31 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        name: "page_view",
        source: "browser",
        actor_id: `visitor-${i}`,
        identity_kind: "visitor",
        properties: { path: i % 2 ? "/docs" : "/", referrer: "Direct" },
      })),
    }),
  });
  expect(response.ok).toBe(true);
});
test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), product.id);
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
});

test("manual Overview refresh retains cards and chart without layout movement", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("31");
  const widgets = page.locator(".overview-widget");
  const cards = await widgets.elementHandles();
  const charts = await page.locator(".overview-widget svg.ts-chart").elementHandles();
  const geometry = () =>
    widgets.evaluateAll((elements) =>
      elements.map((element) => {
        const { x, y, width, height } = element.getBoundingClientRect();
        return { x, y, width, height };
      }),
    );
  const before = await geometry();
  expect(cards).toHaveLength(6);
  expect(charts.length).toBeGreaterThan(1);
  const release = await holdQuery(page);
  try {
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByRole("button", { name: "Refresh analytics" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    for (const element of [...cards, ...charts])
      expect(await element.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("31");
    expect(await geometry()).toEqual(before);
    await page.screenshot({ path: test.info().outputPath("overview-refreshing.png") });
  } finally {
    release();
  }
  await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
});

test("manual Explore refresh retains results, rows, and current pagination", async ({ page }) => {
  await page.goto("/explore");
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await expect(page.locator(".event-card")).toHaveAttribute("aria-busy", "false");
  // Establish geometry after scrolling from the pagination footer to the refresh control.
  await page.getByRole("button", { name: "Refresh analytics" }).scrollIntoViewIfNeeded();
  const chart = await page.locator(":is(.activity-widget, .chart-card)").elementHandle();
  const stream = await page.locator(".event-card").elementHandle();
  const row = await page.locator(".event-card tbody tr").first().elementHandle();
  const before = await page.locator(".event-card").boundingBox();
  const release = await holdQuery(page);
  try {
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByRole("button", { name: "Refresh analytics" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(await chart?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await stream?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await row?.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.getByText("Page 2 of 3")).toBeVisible();
    await expect(page.getByText("across 31 matching events")).toBeVisible();
    expect(await page.locator(".event-card").boundingBox()).toEqual(before);
    await page.screenshot({ path: test.info().outputPath("explore-refreshing.png") });
  } finally {
    release();
  }
  await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
});

for (const path of ["/", "/explore"]) {
  test(`failed refresh at ${path} keeps known results and can retry`, async ({ page }) => {
    await page.goto(path);
    const content = page
      .locator(path === "/" ? ".activity-widget .widget-value" : ".explore-summary")
      .first();
    await expect(content).toContainText("31");
    const chart = await page.locator(":is(.activity-widget, .chart-card)").elementHandle();
    const row =
      path === "/explore"
        ? await page.locator(".event-card tbody tr").first().elementHandle()
        : null;
    await page.route(
      "**/api/products/*/query",
      (route) =>
        route.fulfill({
          status: 503,
          json: { error: "Refresh temporarily unavailable" },
        }),
      { times: 1 },
    );
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByRole("alert").first()).toContainText("Refresh temporarily unavailable");
    await expect(content).toContainText("31");
    expect(await chart?.evaluate((element) => element.isConnected)).toBe(true);
    if (row) expect(await row.evaluate((element) => element.isConnected)).toBe(true);
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(content).toContainText("31");
  });
}

test("narrow Explore refresh keeps rows and controls in place", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/explore");
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  const builder = await page.locator(".query-builder").boundingBox();
  const stream = await page.locator(".event-card").boundingBox();
  const row = await page.locator(".event-card tbody tr").first().elementHandle();
  const release = await holdQuery(page);
  try {
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeDisabled();
    expect(await row?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.locator(".query-builder").boundingBox()).toEqual(builder);
    expect(await page.locator(".event-card").boundingBox()).toEqual(stream);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("mobile-refreshing.png") });
  } finally {
    release();
  }
  await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
});
