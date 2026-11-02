import { expect, test, type Page } from "@playwright/test";
import type { Product } from "../apps/dashboard/src/lib/api";

const api = process.env.PIKO_API_URL;
if (!api) throw new Error("Use the isolated E2E runner");
const day = 86400000;
const today = new Date().toISOString().slice(0, 10);
const midnight = Date.parse(`${today}T00:00:00Z`);
const start = new Date(midnight - 6 * day).toISOString().slice(0, 10);
const end = new Date(midnight - 4 * day).toISOString().slice(0, 10);
const from = `${start}T00:00:00.000Z`;
const to = new Date(midnight - 3 * day).toISOString();
let project: Product;
async function post(path: string, body: unknown) {
  const response = await fetch(`${api}/api${path}`, {
    method: "POST",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function open(page: Page) {
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  await page.goto(`/projects/${project.slug}?source=all&days=30`);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("4");
}
const picker = (page: Page) => page.getByRole("dialog", { name: "Date range", exact: true });
const trigger = (page: Page) =>
  page.getByRole("button", { name: "Choose date range", exact: true });

test.beforeAll(async () => {
  project = await post("/products", { name: `Calendar ${Date.now()}`, retention_days: 365 });
  const { key } = await post(`/products/${project.id}/keys`, { label: "Calendar fixture" });
  const response = await fetch(`${api}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      events: [Date.parse(from) - 1, Date.parse(from), Date.parse(to) - 1, Date.parse(to)].map(
        (timestamp, i) => ({
          event_id: crypto.randomUUID(),
          name: "checkout",
          source: "sdk",
          timestamp: new Date(timestamp).toISOString(),
          properties: { amount: (i + 1) * 10 },
        }),
      ),
    }),
  });
  expect(response.ok).toBe(true);
});

test("calendar applies inclusive UTC dates, preserves scope, and shares across timezones", async ({
  page,
  browser,
}) => {
  await open(page);
  const original = page.url();
  await trigger(page).click();
  await expect(picker(page).getByRole("grid")).toHaveCount(2);
  await picker(page).locator(`button[data-day="${start}"]`).click();
  await expect(
    picker(page).getByRole("button", { name: "Apply range", exact: true }),
  ).toBeDisabled();
  await picker(page).locator(`button[data-day="${end}"]`).click();
  await expect(picker(page).getByLabel("Start date", { exact: true })).toHaveValue(start);
  await expect(picker(page).getByLabel("End date", { exact: true })).toHaveValue(end);
  expect(page.url()).toBe(original);
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith(`/products/${project.id}/query`) &&
      r.postDataJSON().from === from &&
      r.postDataJSON().to === to,
  );
  await picker(page).getByRole("button", { name: "Apply range", exact: true }).click();
  await request;
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
  await expect(trigger(page)).toHaveAttribute("data-fixed", "true");
  const link = page.url();
  expect(new URL(link).searchParams.get("from")).toBe(from);
  expect(new URL(link).searchParams.get("to")).toBe(to);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByText("across 2 matching events")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("from")).toBe(from);
  await page.goBack();
  const recipient = await browser.newContext({
    ignoreHTTPSErrors: true,
    timezoneId: "America/Los_Angeles",
  });
  try {
    const shared = await recipient.newPage();
    await shared.goto(link);
    await expect(shared.locator(".activity-widget .widget-value").first()).toHaveText("2");
    await trigger(shared).click();
    await expect(picker(shared).getByLabel("Start date", { exact: true })).toHaveValue(start);
    await expect(picker(shared).getByLabel("End date", { exact: true })).toHaveValue(end);
    await expect(picker(shared).locator(`button[data-day="${start}"]`)).toHaveAttribute(
      "data-range-start",
      "true",
    );
  } finally {
    await recipient.close();
  }
  await page.getByRole("button", { name: "Last 7 days", exact: true }).click();
  await expect(trigger(page)).toContainText("Custom range");
  expect(new URL(page.url()).searchParams.has("from")).toBe(false);
  expect(new URL(page.url()).searchParams.has("to")).toBe(false);
  await page.goBack();
  await expect(trigger(page)).toHaveAttribute("data-fixed", "true");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
});

for (const width of [1440, 390]) {
  test(`date drafts cancel, reject invalid input, and keep layout stable at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await open(page);
    const url = page.url();
    const before = await page.locator("#main-content").boundingBox();
    await trigger(page).click();
    await expect(picker(page).getByRole("grid")).toHaveCount(width < 768 ? 1 : 2);
    expect(await page.locator("#main-content").boundingBox()).toEqual(before);
    const box = await picker(page).boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await picker(page).getByLabel("Start date", { exact: true }).fill(end);
    await picker(page).getByLabel("End date", { exact: true }).fill(start);
    await expect(picker(page).locator("#range-feedback")).toContainText("on or after");
    await expect(picker(page).getByRole("button", { name: "Apply range" })).toBeDisabled();
    await picker(page).getByLabel("Start date", { exact: true }).fill("2026-02-30");
    await expect(picker(page).locator("#range-feedback")).toContainText("valid dates");
    await page.keyboard.press("Escape");
    await expect(picker(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    expect(page.url()).toBe(url);
    await trigger(page).click();
    await expect(picker(page).getByLabel("Start date", { exact: true })).not.toHaveValue(
      "2026-02-30",
    );
    await picker(page).getByLabel("Start date", { exact: true }).fill(start);
    await picker(page).getByLabel("End date", { exact: true }).fill(start);
    await expect(picker(page).locator("#range-feedback")).toHaveText("1 day selected");
    await picker(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(picker(page)).toBeHidden();
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("legacy snapshot links display a calendar range without a pin button", async ({ page }) => {
  await page.goto(
    `/projects/${project.slug}?days=30&snapshot=${encodeURIComponent(new Date().toISOString())}`,
  );
  await expect(trigger(page)).toHaveAttribute("data-fixed", "true");
  await expect(page.getByRole("button", { name: "Pin dates" })).toHaveCount(0);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("4");
});

test("changing calendar dates preserves a drilldown's event and typed filter", async ({ page }) => {
  const selection = {
    from,
    to,
    sourceId: project.sources[0].id,
    event: "checkout",
    filter: { property: "amount", value: 20 },
  };
  await page.goto(
    `/projects/${project.slug}/explore?drilldown=${encodeURIComponent(JSON.stringify(selection))}`,
  );
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await trigger(page).click();
  const widerStart = new Date(Date.parse(from) - day).toISOString().slice(0, 10);
  await picker(page).getByLabel("Start date", { exact: true }).fill(widerStart);
  await picker(page).getByLabel("End date", { exact: true }).fill(today);
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith(`/products/${project.id}/query`) &&
      r.postDataJSON().from === `${widerStart}T00:00:00.000Z`,
  );
  await picker(page).getByRole("button", { name: "Apply range", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    event: "checkout",
    filters: [{ property: "amount", op: "eq", value: 20 }],
  });
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await expect(page.getByLabel("Typed value")).toHaveValue("20");
});

test("calendar supports keyboard focus, range selection, and dismissal", async ({ page }) => {
  await open(page);
  const url = page.url();
  await trigger(page).click();
  await expect(picker(page).locator('button[data-range-start="true"]')).toBeFocused();
  const first = picker(page).locator(`button[data-day="${start}"]`);
  await first.focus();
  await first.press("Enter");
  await expect(picker(page).getByLabel("End date", { exact: true })).toHaveValue("");
  await first.press("ArrowRight");
  const nextDay = new Date(Date.parse(from) + day).toISOString().slice(0, 10);
  const next = picker(page).locator(`button[data-day="${nextDay}"]`);
  await expect(next).toBeFocused();
  await next.press("ArrowRight");
  const last = picker(page).locator(`button[data-day="${end}"]`);
  await expect(last).toBeFocused();
  await last.press("Enter");
  await expect(picker(page).getByLabel("Start date", { exact: true })).toHaveValue(start);
  await expect(picker(page).getByLabel("End date", { exact: true })).toHaveValue(end);
  await expect(picker(page).locator("#range-feedback")).toHaveText("3 days selected");
  await page.keyboard.press("Escape");
  await expect(picker(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  expect(page.url()).toBe(url);
});
