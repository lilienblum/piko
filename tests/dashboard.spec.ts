import { expect, test, type Page } from "@playwright/test";
const apiUrl = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
const dashboard = "http://127.0.0.1:3000";
async function admin(path: string, body?: unknown) {
  const response = await fetch(`${apiUrl}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function openWorkspace(page: Page) {
  await page.goto("/");
  await expect(page.getByRole("combobox", { name: "Select product" })).toBeVisible();
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function appearance(page: Page, theme: "Light" | "Dark" | "Auto") {
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
}
let web: { id: string; name: string; key: string };
let tool: { id: string; name: string; key: string };
const range = () => ({
  from: new Date(Date.now() - 86400000).toISOString(),
  to: new Date(Date.now() + 1000).toISOString(),
});
test.beforeAll(async () => {
  const suffix = Date.now();
  for (const kind of ["website", "tool"]) {
    const p = await admin("/products", { name: `E2E ${kind} ${suffix}`, kind, retention_days: 30 });
    const { key } = await admin(`/products/${p.id}/keys`, { label: "E2E fixture" });
    const data = { ...p, key };
    if (kind === "website") web = data;
    else tool = data;
    const events = Array.from({ length: 32 }, (_, i) => ({
      event_id: crypto.randomUUID(),
      name: kind === "website" ? "page_view" : "command_run",
      source: kind === "website" ? "browser" : "cli",
      actor_id: `actor-${Math.floor(i / 2)}`,
      identity_kind: kind === "website" ? "visitor" : "installation",
      ...(kind === "website" ? { session_id: `s-${Math.floor(i / 2)}` } : {}),
      properties:
        kind === "website"
          ? { path: i % 2 ? "/docs" : "/", referrer: "Direct" }
          : {
              command: i % 2 ? "build" : "deploy",
              duration_ms: 100 + i * 10,
              success: i % 2 === 0,
              version: "1.0.0",
              os: "linux",
            },
    }));
    const response = await fetch(`${apiUrl}/api/ingest`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ events }),
    });
    expect(response.status).toBe(200);
  }
});
test("website and tool overviews, numeric query, filtering and server pagination", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await openWorkspace(page);
  await select(page, "Select product", web.name);
  await expect(page.getByRole("heading", { name: web.name })).toBeVisible();
  await expect(page.getByText("Top pages", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("32");
  await select(page, "Select product", tool.name);
  await expect(page.getByText("Command executions", { exact: true })).toBeVisible();
  await expect(page.locator(".metric-value").nth(2)).toHaveText("50%");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await select(page, "Measure", "Numeric average");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.locator(".explore-summary strong")).toHaveText("255 ms");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  const filter = page.getByRole("button", { name: "Filter", exact: true });
  await expect(filter).toHaveAttribute("aria-expanded", "false");
  await filter.click();
  await expect(filter).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Property", { exact: true }).fill("success");
  await page.getByLabel("Typed value").fill("true");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.locator(".explore-summary strong")).toHaveText("250 ms");
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await select(page, "Date range", "Last 7 days");
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  expect(errors).toEqual([]);
});
test("create product, edit retention, create and revoke a key", async ({ page }) => {
  await openWorkspace(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "New product" }).click();
  const dialog = page.getByRole("dialog");
  const name = `UI product ${Date.now()}`;
  await dialog.getByLabel("Product name").fill(name);
  await dialog.getByRole("combobox", { name: "Product type" }).click();
  await page.getByRole("option", { name: "Generic product" }).click();
  await dialog.getByRole("button", { name: "Create product", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Product name")).toHaveValue(name);
  await page.getByLabel("Retention (days)").fill("14");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Product changes saved.")).toBeVisible();
  await page.getByLabel("New key label").fill("Temporary key");
  await page.getByRole("button", { name: "Create ingestion key" }).click();
  await expect(page.getByText("Copy your new key")).toBeVisible();
  const key = (await page.locator(".new-key").textContent()) ?? "";
  expect(key).toMatch(/^pk_/);
  await page.getByRole("button", { name: "Revoke Temporary key" }).click();
  await page.getByRole("button", { name: "Revoke key", exact: true }).click();
  await expect(page.getByText("Ingestion key revoked.")).toBeVisible();
  const response = await fetch(`${apiUrl}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ event_id: "revoked", name: "test", source: "test" }),
  });
  expect(response.status).toBe(401);
  await page.getByRole("tab", { name: "Rust CLI" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("cargo run");
  await page.getByRole("tab", { name: "TypeScript" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("await piko.send");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByText("Your next insight starts with an event")).toBeVisible();
});
test("mobile website and tool layouts do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  for (const p of [web, tool]) {
    await select(page, "Select product", p.name);
    await expect(page.getByRole("heading", { name: p.name })).toBeVisible();
    await expect(page.locator(".metric-value").first()).toHaveText("32");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
test("browser tracker sends page/SPA/custom events, preserves identity, and retains types", async ({
  page,
}) => {
  const p = await admin("/products", {
    name: `Tracker ${Date.now()}`,
    kind: "website",
    retention_days: 30,
  });
  const { key } = await admin(`/products/${p.id}/keys`, { label: "Tracker" });
  const fixture = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () =>
      new Response(
        `<html><body>Tracker fixture<script type="module">import {startBrowserTracker} from '${dashboard}/tracker.js'; window.tracker=startBrowserTracker({endpoint:'${apiUrl}',key:'${key}',identity:'persistent',identityScope:'${p.id}'});</script></body></html>`,
        { headers: { "content-type": "text/html" } },
      ),
  });
  try {
    await page.goto(`${fixture.url}?utm_source=newsletter`);
    await page.waitForFunction(() => "tracker" in window);
    await page.evaluate(async () => {
      const tracker = (
        window as unknown as {
          tracker: { track: (n: string, p: unknown) => void; flush: () => Promise<void> };
        }
      ).tracker;
      history.pushState({}, "", "/docs?utm_campaign=launch");
      tracker.track("checkout", { amount: 12.5, paid: true, plan: "pro" });
      await tracker.flush();
    });
    let result = await admin(`/products/${p.id}/query`, { ...range() });
    expect(result.summary.total).toBe(3);
    expect(result.summary.visitors).toBe(1);
    expect(result.summary.sessions).toBe(1);
    const custom = result.events.find((e: { name: string }) => e.name === "checkout");
    expect(custom.properties).toEqual({ amount: 12.5, paid: true, plan: "pro" });
    expect(
      result.events.find((e: { properties: { path?: string } }) => e.properties.path === "/docs")
        .properties.utm_campaign,
    ).toBe("launch");
    await page.reload();
    await page.waitForFunction(() => "tracker" in window);
    await page.evaluate(
      async () =>
        await (window as unknown as { tracker: { flush: () => Promise<void> } }).tracker.flush(),
    );
    result = await admin(`/products/${p.id}/query`, range());
    expect(result.summary.total).toBe(4);
    expect(result.summary.visitors).toBe(1);
    expect(result.summary.sessions).toBe(1);
  } finally {
    await fixture.stop(true);
  }
});

test("sidebar collapses, persists and keeps navigation keyboard accessible", async ({ page }) => {
  await openWorkspace(page);
  const sidebar = page.locator('[data-slot="sidebar"][data-state]');
  await expect(sidebar).toHaveAttribute("data-state", "expanded");
  await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await expect(page.locator(".local-note")).not.toBeVisible();
  await expect(page.locator(".sidebar-footer")).not.toBeVisible();
  await page.reload();
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Follow your curiosity" })).toBeVisible();
  const measure = page.getByRole("combobox", { name: "Measure", exact: true });
  await measure.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option", { name: "Event count", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("option", { name: "Duration p95", exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(measure).toContainText("Duration p95");
});

test("light, dark and auto themes persist and follow system changes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await openWorkspace(page);
  await expect(page.locator("html")).toHaveClass("dark");
  await appearance(page, "Light");
  await expect(page.locator("html")).toHaveClass("light");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("light");
  await appearance(page, "Dark");
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "New product" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.getByRole("dialog").evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(17, 21, 31)");
  await page.keyboard.press("Escape");
  await appearance(page, "Auto");
  await expect(page.locator("html")).toHaveClass("light");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.locator("html")).toHaveClass("dark");
  expect(await page.evaluate(() => localStorage.getItem("piko:theme"))).toBe("auto");
  // A second tab updates the current tab through the browser's storage event.
  const other = await page.context().newPage();
  await other.goto("/");
  await appearance(other, "Light");
  await expect(page.locator("html")).toHaveClass("light");
  await other.close();
  expect(errors).toEqual([]);
});

test("saved appearance is applied before the application JavaScript loads", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("piko:theme", "dark"));
  await page.emulateMedia({ colorScheme: "light" });
  await page.route("**/assets/*.js", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator("html")).toHaveClass("dark");
  expect(await page.locator("body").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    "rgb(17, 21, 31)",
  );
});

test("mobile drawer navigates and dark selects fit the screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await appearance(page, "Dark");
  await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Sidebar", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "Follow your curiosity" })).toBeVisible();
  await select(page, "Select product", tool.name);
  await select(page, "Measure", "Numeric average");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.locator(".explore-summary strong")).toHaveText("255 ms");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
