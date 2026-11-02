import { expect, test, type Page } from "@playwright/test";
import type { Product } from "../apps/dashboard/src/lib/api";
const api = process.env.PIKO_API_URL;
if (!api) throw new Error("The isolated E2E API must be configured");
let project: Product;
let other: Product;
async function post(path: string, body: unknown) {
  const response = await fetch(`${api}/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function select(page: Page, label: string, value: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
const params = (page: Page) => new URL(page.url()).searchParams;
test.beforeAll(async () => {
  project = await post("/products", { name: `Link project ${Date.now()}`, retention_days: 365 });
  other = await post("/products", {
    name: `Other link project ${Date.now()}`,
    retention_days: 365,
  });
  const { key } = await post(`/products/${project.id}/keys`, { label: "URL fixture" });
  const response = await fetch(`${api}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      events: Array.from({ length: 31 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        name: "command_run",
        source: "cli",
        timestamp: new Date(Date.now() - i * 1000).toISOString(),
        properties: { command: "build", duration_ms: 100 + i * 10, success: i % 2 === 0 },
      })),
    }),
  });
  expect(response.ok).toBe(true);
});
test.beforeEach(async ({ page }) => {
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  await page.addInitScript((id) => {
    localStorage.setItem("piko:product", id);
    localStorage.setItem("piko:days", "90");
  }, other.id);
});

test("project URL wins over saved preferences and applies a portable calendar range", async ({
  page,
  browser,
}) => {
  await page.goto(`/projects/${project.slug}?source=all&days=7`);
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(project.name);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("31");
  await expect(page.getByRole("button", { name: "Choose date range" })).toContainText(
    "Last 7 days",
  );
  await select(page, "Breakdown", "Commands");
  expect(params(page).has("interval")).toBe(false);
  await expect.poll(() => params(page).get("breakdown")).toBe("property:command");
  await page.getByRole("button", { name: "Choose date range", exact: true }).click();
  const picker = page.getByRole("dialog", { name: "Date range", exact: true });
  await page.getByRole("menuitemradio", { name: "Custom range", exact: true }).click();
  const start = await picker.getByLabel("Start date", { exact: true }).inputValue();
  const end = await picker.getByLabel("End date", { exact: true }).inputValue();
  await picker.getByRole("button", { name: "Apply range", exact: true }).click();
  await expect(picker).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Choose date range", exact: true }),
  ).toHaveAttribute("data-fixed", "true");
  const from = params(page).get("from");
  const to = params(page).get("to");
  expect(from).toBe(`${start}T00:00:00.000Z`);
  expect(to).toBe(new Date(Date.parse(`${end}T00:00:00Z`) + 86400000).toISOString());
  const link = page.url();
  const fresh = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const recipient = await fresh.newPage();
    await recipient.goto(link);
    await expect(recipient.getByRole("combobox", { name: "Select project" })).toContainText(
      project.name,
    );
    await expect(recipient.locator(".activity-widget .chart-period-note")).toContainText(
      "One point per day",
    );
    await expect(recipient.getByRole("combobox", { name: "Breakdown", exact: true })).toContainText(
      "Commands",
    );
    await expect(recipient.locator(".activity-widget .widget-value").first()).toHaveText("31");
    expect(params(recipient).get("from")).toBe(from);
    expect(params(recipient).get("to")).toBe(to);
  } finally {
    await fresh.close();
  }
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.slug}/settings`);
  expect(params(page).has("project")).toBe(false);
  expect(params(page).get("from")).toBe(from);
  expect(params(page).get("to")).toBe(to);
  await page.goBack();
  await expect(page.locator(".activity-widget .chart-period-note")).toContainText(
    "One point per day",
  );
  await page.getByRole("button", { name: "Choose date range", exact: true }).click();
  await page.getByRole("menuitemradio", { name: "Last 30 days", exact: true }).click();
  await expect.poll(() => params(page).has("from")).toBe(false);
  expect(params(page).has("to")).toBe(false);
});

test("applied Explore queries and pages survive reload and browser history", async ({ page }) => {
  await page.goto(`/projects/${project.slug}/explore?source=all&days=30`);
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  await select(page, "Measure", "Numeric average");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByLabel("Property", { exact: true }).fill("success");
  await page.getByLabel("Typed value").fill("true");
  expect(params(page).has("query")).toBe(false);
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  expect(JSON.parse(params(page).get("query") ?? "null")).toMatchObject({
    measure: "avg",
    filterValue: "true",
  });
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Measure", exact: true })).toContainText(
    "Numeric average",
  );
  await expect(page.getByLabel("Typed value")).toHaveValue("true");
  await select(page, "Measure", "Event count");
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Measure", exact: true })).toContainText(
    "Numeric average",
  );
  await page.goForward();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
});

test("source links remain scoped and invalid selections never query a fallback project", async ({
  page,
}) => {
  let queries = 0;
  page.on("request", (request) => {
    if (request.url().endsWith("/query")) queries++;
  });
  for (const link of [
    `/projects/does-not-exist`,
    `/projects/${project.slug}?source=${other.sources[0].id}`,
    `/projects/${project.slug}?snapshot=yesterday`,
    `/projects/${project.slug}?from=2026-01-01T00:00:00.000Z`,
    `/projects/${project.slug}?from=2026-02-02T00:00:00.000Z&to=2026-02-01T00:00:00.000Z`,
    `/projects/${project.slug}/explore?drilldown=${encodeURIComponent(JSON.stringify({ productId: other.id, from: "2026-11-01T00:00:00.000Z", to: "2026-11-02T00:00:00.000Z" }))}`,
    `/projects/${project.slug}/explore?query=${encodeURIComponent(JSON.stringify({ measure: "sql" }))}`,
  ]) {
    await page.goto(link);
    await expect(
      page.getByRole("heading", { name: "This selection is unavailable" }),
    ).toBeVisible();
  }
  expect(queries).toBe(0);
  await page
    .getByRole("button", { name: "Clear selection", exact: true })
    .or(page.getByRole("link", { name: "Clear selection", exact: true }))
    .click();
  await expect(page.getByRole("heading", { name: "This selection is unavailable" })).toBeHidden();
  await page.goto(`/projects/${project.slug}?source=${project.sources[0].id}&days=7`);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("31");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  expect(params(page).get("source")).toBe(project.sources[0].id);
});

test("automatic refresh changes neither the current URL nor browser history", async ({ page }) => {
  await page.goto(`/projects/${project.slug}?source=all&days=30`);
  await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
  const url = page.url();
  const history = await page.evaluate(() => window.history.length);
  const response = page.waitForResponse((r) => r.url().endsWith(`/products/${project.id}/query`));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await response;
  await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
  expect(page.url()).toBe(url);
  expect(await page.evaluate(() => window.history.length)).toBe(history);
});

test("project paths win over legacy query slugs and project switching updates the path", async ({
  page,
}) => {
  await page.goto(`/projects/${project.slug}?project=${other.slug}`);
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(project.name);
  await expect.poll(() => params(page).has("project")).toBe(false);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("31");
  await select(page, "Select project", other.name);
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/projects/${other.slug}`);
  await page.goBack();
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(project.name);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/projects/${project.slug}/explore`);
  // The full-navigation fixture seeds the other project as the saved preference.
  await page.goto("/settings");
  await expect.poll(() => new URL(page.url()).pathname).toBe(`/projects/${other.slug}/settings`);
});

for (const [label, dates] of Object.entries<Record<string, string>>({
  "custom dates": { from: "2025-01-01T00:00:00.000Z", to: "2025-01-08T00:00:00.000Z" },
  "calendar period": { period: "last-month" },
})) {
  test(`switching projects resets Overview filters and ${label}`, async ({ page }) => {
    const search = new URLSearchParams({
      ...dates,
      source: other.sources[0].id,
      days: "90",
      filter: JSON.stringify({ field: "property:success", value: true }),
      metric: "average",
      breakdown: "property:command",
      duration: "p95",
    });
    await page.goto(`/projects/${other.slug}?${search}`);
    await expect(page.getByRole("combobox", { name: "Chart metric" })).toContainText(
      "Average duration",
    );
    const previous = page.url();
    const request = page.waitForRequest(
      (r) =>
        r.url().endsWith(`/products/${project.id}/query`) && r.postDataJSON().group_by === "name",
    );
    await select(page, "Select project", project.name);
    await expect(page.locator(".activity-widget .widget-value")).toHaveText("31");
    expect(Object.fromEntries(params(page))).toEqual({ source: "all", days: "7" });
    await expect(page.getByRole("button", { name: "Choose date range" })).toContainText(
      "Last 7 days",
    );
    await expect(page.getByRole("combobox", { name: "Chart metric" })).toContainText("Events");
    await expect(page.getByRole("combobox", { name: "Breakdown" })).toContainText("Top events");
    const body = (await request).postDataJSON();
    expect(body).toMatchObject({ measure: "count", group_by: "name", filters: [] });
    expect(body.source_id).toBeUndefined();
    expect(body.event).toBeUndefined();
    expect(body.source).toBeUndefined();
    expect(Date.parse(body.to) - Date.parse(body.from)).toBeGreaterThanOrEqual(6 * 86400000);
    expect(Date.parse(body.to) - Date.parse(body.from)).toBeLessThanOrEqual(7 * 86400000);
    await page.goBack();
    await expect(page).toHaveURL(previous);
    await expect(page.getByRole("combobox", { name: "Chart metric" })).toContainText(
      "Average duration",
    );
    expect(JSON.parse(params(page).get("filter") ?? "null")).toEqual({
      field: "property:success",
      value: true,
    });
    await page.goForward();
    await expect(page.locator(".activity-widget .widget-value")).toHaveText("31");
    expect(Object.fromEntries(params(page))).toEqual({ source: "all", days: "7" });
  });
}

test("switching projects resets Explore queries, drafts, drilldowns and pagination", async ({
  page,
}) => {
  const search = new URLSearchParams({
    source: other.sources[0].id,
    days: "7",
    snapshot: "2025-01-08T00:00:00.000Z",
    drilldown: JSON.stringify({
      productId: other.id,
      sourceId: other.sources[0].id,
      from: "2025-01-01T00:00:00.000Z",
      to: "2025-01-08T00:00:00.000Z",
      event: "command_run",
      source: "cli",
      filter: { property: "success", value: true },
    }),
    query: JSON.stringify({
      event: "command_run",
      source: "cli",
      measure: "avg",
      group: "property:command",
      filterProperty: "success",
      filterValue: "true",
    }),
    page: "2",
    pageSize: "30",
  });
  await page.goto(`/projects/${other.slug}/explore?${search}`);
  await expect(page.getByRole("region", { name: "Overview selection" })).toBeVisible();
  await expect(page.getByLabel("Typed value")).toHaveValue("true");
  await page.getByLabel("Typed value").fill("false");
  const previous = page.url();
  const request = page.waitForRequest((r) => r.url().endsWith(`/products/${project.id}/query`));
  await select(page, "Select project", project.name);
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.slug}/explore`);
  expect(Object.fromEntries(params(page))).toEqual({ source: "all", days: "7" });
  expect((await request).postDataJSON()).toMatchObject({
    measure: "count",
    group_by: "name",
    filters: [],
    page: 0,
    page_size: 15,
  });
  expect((await request).postDataJSON().source_id).toBeUndefined();
  expect((await request).postDataJSON().event).toBeUndefined();
  expect((await request).postDataJSON().source).toBeUndefined();
  await expect(page.getByRole("region", { name: "Overview selection" })).toBeHidden();
  await expect(page.getByRole("combobox", { name: "Event", exact: true })).toContainText(
    "All events",
  );
  await expect(page.getByRole("combobox", { name: "Measure", exact: true })).toContainText(
    "Event count",
  );
  await expect(page.getByRole("button", { name: "Filter", exact: true })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await expect(page.getByText("Page 1 of 3")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(previous);
  await expect(page.getByRole("region", { name: "Overview selection" })).toBeVisible();
  await expect(page.getByLabel("Typed value")).toHaveValue("true");
  expect(params(page).get("page")).toBe("2");
  expect(params(page).get("pageSize")).toBe("30");
  await page.goForward();
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  expect(JSON.parse(params(page).get("query") ?? "null")).toMatchObject({
    event: "",
    source: "",
    measure: "count",
    filterProperty: "",
    filterValue: "",
  });
});
