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

test("project URL wins over saved preferences and pins a portable date range", async ({
  page,
  browser,
}) => {
  await page.goto(`/projects/${project.slug}?source=all&days=7`);
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(project.name);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("31");
  await expect(page.getByRole("button", { name: "Last 7 days" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Weekly", exact: true }).click();
  await select(page, "Breakdown", "Commands");
  await expect.poll(() => params(page).get("interval")).toBe("week");
  await expect.poll(() => params(page).get("breakdown")).toBe("property:command");
  await page.getByRole("button", { name: "Pin dates", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fixed dates", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const snapshot = params(page).get("snapshot");
  expect(Number.isFinite(Date.parse(snapshot ?? ""))).toBe(true);
  const link = page.url();
  const fresh = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const recipient = await fresh.newPage();
    await recipient.goto(link);
    await expect(recipient.getByRole("combobox", { name: "Select project" })).toContainText(
      project.name,
    );
    await expect(recipient.getByRole("button", { name: "Weekly", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(recipient.getByRole("combobox", { name: "Breakdown", exact: true })).toContainText(
      "Commands",
    );
    await expect(recipient.locator(".activity-widget .widget-value").first()).toHaveText("31");
    expect(params(recipient).get("snapshot")).toBe(snapshot);
  } finally {
    await fresh.close();
  }
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.slug}/settings`);
  expect(params(page).has("project")).toBe(false);
  expect(params(page).get("snapshot")).toBe(snapshot);
  await page.goBack();
  await expect(page.getByRole("button", { name: "Weekly", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Last 30 days", exact: true }).click();
  await expect.poll(() => params(page).has("snapshot")).toBe(false);
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
