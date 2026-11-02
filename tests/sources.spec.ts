import { expect, test, type Page } from "@playwright/test";
const endpoint = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
async function select(page: Page, name: string, value: string) {
  if (name === "Select source") {
    if (!(await page.getByRole("navigation", { name: "Project sources" }).isVisible()))
      await page.getByRole("button", { name: "Toggle Sidebar" }).click();
    await page
      .getByRole("navigation", { name: "Project sources" })
      .getByRole("button", { name: value, exact: true })
      .click();
    return;
  }
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
  await page.getByRole("button", { name: "Edit source Events", exact: true }).click();
  await dialog.getByLabel("Source name").fill("Website");
  await expect(dialog.getByRole("combobox", { name: "Icon", exact: true })).toContainText(
    "Automatic · Website",
  );
  await dialog.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("New key label").fill("Website key");
  await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
  const websiteKey = (await page.locator(".new-key").textContent()) ?? "";
  await ingest(websiteKey, "page_view", 10);

  await page.getByRole("button", { name: "Add source", exact: true }).click();
  await dialog.getByLabel("Source name").fill("iOS app");
  await expect(dialog.getByLabel("Source type")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Create source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".source-row")).toHaveCount(2);
  await select(page, "Key source", "iOS app");
  await expect(page.locator(".new-key")).toHaveCount(0);
  await expect(page.getByRole("tab", { name: "Browser", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("tab", { name: "HTTP / Mobile" }).click();
  await page.getByLabel("New key label").fill("iOS key");
  await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
  const mobileKey = (await page.locator(".new-key").textContent()) ?? "";
  expect(mobileKey).not.toBe(websiteKey);
  await ingest(mobileKey, "screen_view", 20);
  await expect(page.locator(".integration-code")).toContainText(mobileKey);

  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
  const sources = page.locator(".sources-widget");
  await expect(sources.getByRole("link", { name: "Filter by Website", exact: true })).toBeVisible();
  await select(page, "Select source", "Website");
  await expect(sources.locator("[data-chart-kind='donut']")).toHaveCount(0);
  await expect(sources).toHaveCount(0);
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("1");
  await select(page, "Select source", "All sources");
  await expect(sources).toBeVisible();
  await page.getByRole("link", { name: "Filter by iOS app", exact: true }).click();
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("1");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  const linked = page.url();
  await page.reload();
  await expect(page.locator(".workspace-source-name")).toContainText("iOS app");
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
  await expect(page.locator(".workspace-source-name")).toContainText("Website");
  await page.goto(linked);
  await expect(page.locator(".workspace-source-name")).toContainText("iOS app");
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await select(page, "Select source", "All sources");
  await expect(page.getByRole("dialog", { name: "Sidebar", exact: true })).not.toBeVisible();
  await expect(page.locator(".workspace-source-name")).toHaveText("All sources");
  await expect(page.getByText("across 2 matching events")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Select project", exact: true })).toBeVisible();
  await select(page, "Select source", "iOS app");
  await expect(page.locator(".workspace-source-name")).toHaveText("iOS app");
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
  await expect(page.locator(".workspace-source-name")).toContainText("Mobile app");
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await select(page, "Select source", "Mobile app");
  await expect(page.locator(".overview-widget")).toHaveCount(5);
  await expect(page.getByText("No actor IDs received")).toBeVisible();
  await select(page, "Breakdown", "Screens");
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
  await expect(dialog.getByLabel("Source type")).toHaveCount(0);
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

test("automatic and pinned source icons survive renames without changing analytics", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const response = await fetch(`${endpoint}/api/products`, {
    method: "POST",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: JSON.stringify({ name: `Icons ${Date.now()}`, retention_days: 30 }),
  });
  expect(response.ok).toBe(true);
  const project = await response.json();
  expect(project).not.toHaveProperty("kind");
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  await page.goto("/settings");
  await select(page, "Select project", project.name);
  await page.getByRole("button", { name: "Add source", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const icon = dialog.getByRole("combobox", { name: "Icon", exact: true });
  await dialog.getByLabel("Source name").fill("Orbit iOS");
  await expect(icon).toContainText("Automatic · iOS");
  await expect(icon.locator("[data-source-icon]")).toHaveAttribute("data-source-icon", "ios");
  await select(page, "Icon", "Android");
  await dialog.getByLabel("Source name").fill("Orbit Website");
  await expect(icon).toContainText("Android");
  await dialog.getByRole("button", { name: "Create source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.locator(".source-row").filter({ hasText: "Orbit Website" }).locator("[data-source-icon]"),
  ).toHaveAttribute("data-source-icon", "android");
  await page.getByRole("button", { name: "Edit source Orbit Website", exact: true }).click();
  await expect(icon).toContainText("Android");
  await dialog.getByLabel("Source name").fill("Orbit CLI");
  await select(page, "Icon", "Automatic · Terminal");
  await dialog.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.reload();
  await expect(
    page.locator(".source-row").filter({ hasText: "Orbit CLI" }).locator("[data-source-icon]"),
  ).toHaveAttribute("data-source-icon", "terminal");
  await select(page, "Key source", "Orbit CLI");
  await page.getByLabel("New key label").fill("Mixed events");
  await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
  const key = (await page.locator(".new-key").textContent()) ?? "";
  await ingest(key, "command_run", 10);
  await ingest(key, "custom_event", 20);
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await select(page, "Select source", "Orbit CLI");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
  const metrics = await page.locator(".overview-widget h2").allTextContents();
  expect(metrics).toEqual([
    "Activity over time",
    "Breakdown",
    "Identified actors",
    "Success rate",
    "Duration",
  ]);
  await expect(
    page.getByRole("link", { name: "Filter by custom_event", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Edit source Orbit CLI", exact: true }).click();
  await dialog.getByLabel("Source name").fill("Orbit iOS");
  await expect(icon).toContainText("Automatic · iOS");
  await dialog.getByRole("button", { name: "Save source", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.locator(".workspace-source-name")).toContainText("Orbit iOS");
  await expect(
    page.getByRole("button", { name: "Orbit iOS", exact: true }).locator("[data-source-icon]"),
  ).toHaveAttribute("data-source-icon", "ios");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
  expect(await page.locator(".overview-widget h2").allTextContents()).toEqual(metrics);
  await expect(
    page.getByRole("link", { name: "Filter by custom_event", exact: true }),
  ).toBeVisible();
  await select(page, "Chart metric", "Average duration");
  await expect(
    page
      .locator(".activity-widget")
      .getByText("No numeric durations received in this range.", { exact: true }),
  ).toBeVisible();
});
