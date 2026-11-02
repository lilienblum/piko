import { expect, test } from "@playwright/test";

const endpoint = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
let project: { id: string; name: string };
test.beforeAll(async () => {
  const response = await fetch(`${endpoint}/api/products`, {
    method: "POST",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: JSON.stringify({ name: `SSR ${Date.now()}`, retention_days: 30 }),
  });
  expect(response.ok).toBe(true);
  project = await response.json();
});

for (const route of ["/", "/explore", "/settings"]) {
  for (const { width, collapsed } of [
    { width: 1440, collapsed: false },
    { width: 1440, collapsed: true },
    { width: 894, collapsed: false },
    { width: 390, collapsed: true },
  ]) {
    test(`hard reload preserves ${collapsed ? "collapsed" : "expanded"} shell geometry at ${route} (${width}px)`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.addInitScript(
        ({ id, collapsed }) => {
          localStorage.setItem("piko:product", id);
          localStorage.setItem("piko:sidebar", collapsed ? "collapsed" : "expanded");
        },
        { id: project.id, collapsed },
      );
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        // Handled query backpressure still produces a browser network diagnostic.
        if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)"))
          errors.push(message.text());
      });
      const runtime = page.waitForResponse((response) => response.url().endsWith("/_piko/runtime"));
      let release = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route("**/*", async (route) => {
        if (route.request().resourceType() === "script") await gate;
        await route.fallback();
      });
      try {
        await page.goto(route, { waitUntil: "commit" });
        if (width >= 768)
          await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Toggle Sidebar" })).toBeVisible();
        await expect(page.locator(".topbar")).toHaveCount(0);
        await expect(page.locator(".page-content > .workspace-toolbar")).toBeVisible();
        if (route !== "/settings")
          await expect(page.getByRole("combobox", { name: "Date range" })).toContainText(
            "Last 30 days",
          );
        await expect(page.getByRole("status", { name: "Loading workspace" })).toBeVisible();
        await expect(page.getByRole("status", { name: "Loading workspace" })).toHaveCSS(
          "opacity",
          "1",
        );
        await expect(page.getByRole("button", { name: "Toggle Sidebar" })).toBeDisabled();
        await expect(page.getByRole("button", { name: "Appearance" })).toBeDisabled();
        if (route !== "/settings")
          await expect(page.getByRole("combobox", { name: "Date range" })).toBeDisabled();
        await page.evaluate(() => document.fonts.ready);
        const shell = page.locator("#main-content");
        const before = await shell.boundingBox();
        const content = await page.locator(".page-content").boundingBox();
        const toolbar = await page.locator(".workspace-toolbar").elementHandle();
        expect(before?.x).toBe(width < 768 ? 0 : collapsed ? 56 : 240);
        await page.screenshot({ path: test.info().outputPath("before-hydration.png") });
        release();
        await runtime;
        await expect(page.locator(".live-status")).toHaveCount(0);
        await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(
          project.name,
        );
        if (route !== "/settings")
          await expect(page.getByRole("button", { name: "Refresh analytics" })).toBeEnabled();
        await expect(page.getByRole("status", { name: "Loading workspace" })).not.toBeVisible();
        await expect(page.getByRole("button", { name: "Toggle Sidebar" })).toBeEnabled();
        await expect(page.getByRole("button", { name: "Appearance" })).toBeEnabled();
        if (route !== "/settings")
          await expect(page.getByRole("combobox", { name: "Date range" })).toBeEnabled();
        await expect(page.getByRole("alert")).not.toBeVisible();
        const after = await shell.boundingBox();
        const loaded = await page.locator(".page-content").boundingBox();
        expect(after?.x).toBe(before?.x);
        expect(after?.width).toBe(before?.width);
        expect(loaded?.x).toBe(content?.x);
        expect(loaded?.y).toBe(content?.y);
        expect(await toolbar?.evaluate((element) => element.isConnected)).toBe(true);
        expect(errors).toEqual([]);
        await page.screenshot({ path: test.info().outputPath("after-hydration.png") });
      } finally {
        release();
      }
    });
  }
}

test("workspace failure keeps navigation and retries inside the same shell", async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), project.id);
  let requests = 0;
  let fail = true;
  await page.route("**/api/products", async (route) => {
    requests++;
    if (fail) await route.fulfill({ status: 503, json: { error: "Catalog unavailable" } });
    else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Catalog unavailable");
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  const navigation = await page
    .getByRole("navigation", { name: "Main navigation" })
    .elementHandle();
  const beforeRetry = requests;
  fail = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(project.name);
  await expect(page.getByRole("alert")).not.toBeVisible();
  expect(await navigation?.evaluate((element) => element.isConnected)).toBe(true);
  expect(requests).toBe(beforeRetry + 1);
});
