import { expect, test, type Page } from "@playwright/test";
const endpoint = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
async function select(page: Page, name: string, value: string) {
  await page.getByRole("combobox", { name, exact: true }).click();
  await page.getByRole("option", { name: value, exact: true }).click();
}
async function ingest(key: string, name: string, amount: number) {
  const response = await fetch(`${endpoint}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      event_id: crypto.randomUUID(),
      name,
      source: "sdk",
      properties: { amount, paid: true },
    }),
  });
  expect(response.status).toBe(200);
}

test("one project combines website and mobile sources with scoped keys, queries, and shared links", async ({
  page,
}) => {
  test.setTimeout(60_000);
  // New views must see committed events even without a live-update connection.
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const name = `Connected project ${Date.now()}`;
  await page.goto("/settings");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Project name")).toHaveValue(name);
  await page.getByLabel("New key label").fill("Website key");
  await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
  const websiteKey = (await page.locator(".new-key").textContent()) ?? "";
  await ingest(websiteKey, "page_view", 10);

  await page.getByRole("button", { name: "Add source", exact: true }).click();
  await dialog.getByLabel("Source name").fill("iOS app");
  await select(page, "Source type", "Mobile app");
  await dialog.getByRole("button", { name: "Create source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".source-row")).toHaveCount(2);
  await select(page, "Key source", "iOS app");
  await expect(page.locator(".new-key")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "HTTP / Mobile" })).toHaveAttribute(
    "data-state",
    "active",
  );
  await page.getByLabel("New key label").fill("iOS key");
  await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
  const mobileKey = (await page.locator(".new-key").textContent()) ?? "";
  expect(mobileKey).not.toBe(websiteKey);
  await ingest(mobileKey, "screen_view", 20);
  await expect(page.locator(".integration-code")).toContainText(mobileKey);

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("2");
  await expect(page.getByRole("link", { name: "Explore iOS app", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Explore iOS app", exact: true }).click();
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  const linked = page.url();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Select source" })).toContainText("iOS app");
  await expect(page.locator(".event-card tbody")).toContainText("screen_view");
  await expect(page.locator(".event-card tbody")).not.toContainText("page_view");
  await select(page, "Measure", "Numeric sum");
  await page.getByLabel("Numeric property", { exact: true }).fill("amount");
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.locator(".explore-summary strong")).toHaveText("20");
  await select(page, "Select source", "All sources");
  await expect(page.getByText("across 2 matching events")).toBeVisible();
  await select(page, "Group by", "Source");
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.locator(".breakdown-label")).toHaveCount(2);
  expect((await page.locator(".breakdown-label").allTextContents()).sort()).toEqual([
    "Website",
    "iOS app",
  ]);
  await select(page, "Select source", "Website");
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Select source" })).toContainText("Website");
  await page.goto(linked);
  await expect(page.getByRole("combobox", { name: "Select source" })).toContainText("iOS app");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("project-sources-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Edit source iOS app", exact: true }).click();
  await dialog.getByLabel("Source name").fill("Mobile app");
  await dialog.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".source-row")).toContainText(["Website", "Mobile app"]);
  await page.goto(linked);
  await expect(page.getByRole("combobox", { name: "Select source" })).toContainText("Mobile app");
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await select(page, "Select source", "Mobile app");
  await expect(page.locator(".metric-value")).toHaveCount(2);
  await expect(page.getByText("No actor IDs received")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Screens", exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("mobile-source-overview.png"),
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("source creation retries a failed catalog refresh without creating the source twice", async ({
  page,
}) => {
  const response = await fetch(`${endpoint}/api/products`, {
    method: "POST",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: JSON.stringify({
      name: `Source retry ${Date.now()}`,
      kind: "website",
      retention_days: 30,
    }),
  });
  expect(response.ok).toBe(true);
  const project = await response.json();
  await page.goto("/settings");
  await select(page, "Select project", project.name);
  let fail = true;
  let creates = 0;
  page.on("request", (request) => {
    if (request.url().endsWith(`/products/${project.id}/sources`) && request.method() === "POST")
      creates++;
  });
  await page.route("**/api/products", async (route) => {
    if (fail && route.request().method() === "GET")
      await route.fulfill({ status: 503, json: { error: "Catalog temporarily unavailable" } });
    else await route.continue();
  });
  await page.getByRole("button", { name: "Add source", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Source name").fill("Tablet");
  await select(page, "Source type", "Mobile app");
  await dialog.getByRole("button", { name: "Create source", exact: true }).click();
  await expect(dialog.getByText(/Source saved. Could not refresh/)).toBeVisible();
  await expect(dialog.getByLabel("Source name")).toBeDisabled();
  fail = false;
  await dialog.getByRole("button", { name: "Retry loading source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".source-row")).toHaveCount(2);
  expect(creates).toBe(1);

  let queries = 0;
  page.on("request", (request) => {
    if (request.url().endsWith(`/products/${project.id}/query`)) queries++;
  });
  const invalid = {
    productId: project.id,
    sourceId: crypto.randomUUID(),
    from: new Date(Date.now() - 86400000).toISOString(),
    to: new Date().toISOString(),
  };
  await page.goto(`/explore?drilldown=${encodeURIComponent(JSON.stringify(invalid))}`);
  await expect(page.getByRole("heading", { name: "This selection is unavailable" })).toBeVisible();
  await expect(
    page.getByText("The project or source in this link is not available in this workspace."),
  ).toBeVisible();
  expect(queries).toBe(0);
});
