import { expect, test, type Page } from "@playwright/test";
const apiUrl = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
const dashboard = process.env.PIKO_DASHBOARD_URL ?? "http://127.0.0.1:3000";
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
  await expect(page.getByRole("combobox", { name: "Select project" })).toBeVisible();
}
async function select(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function appearance(page: Page, theme: "Light" | "Dark" | "Auto") {
  const mobile = (page.viewportSize()?.width ?? 1440) < 768;
  if (mobile) await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await page.getByRole("button", { name: "Appearance", exact: true }).click();
  await page.getByRole("menuitemradio", { name: theme, exact: true }).click();
  if (mobile) await page.getByRole("button", { name: "Close navigation", exact: true }).click();
}
let web: { id: string; name: string; key: string };
let tool: { id: string; name: string; key: string };
let generic: { id: string; name: string; key: string };
const range = () => ({
  from: new Date(Date.now() - 86400000).toISOString(),
  to: new Date(Date.now() + 1000).toISOString(),
});
test.beforeAll(async () => {
  const suffix = Date.now();
  for (const kind of ["website", "tool", "generic"]) {
    const p = await admin("/products", { name: `E2E ${kind} ${suffix}`, retention_days: 30 });
    const { key } = await admin(`/products/${p.id}/keys`, { label: "E2E fixture" });
    const data = { ...p, key };
    if (kind === "website") web = data;
    else if (kind === "tool") tool = data;
    else generic = data;
    const events = Array.from({ length: 32 }, (_, i) => ({
      event_id: crypto.randomUUID(),
      timestamp: new Date(Date.now() - i * 1000).toISOString(),
      name: kind === "website" ? "page_view" : kind === "tool" ? "command_run" : "activity",
      source:
        kind === "website"
          ? "browser"
          : kind === "tool"
            ? "cli"
            : i < 8
              ? "sdk"
              : `source-${i % 12}`,
      actor_id: `actor-${Math.floor(i / 2)}`,
      identity_kind: kind === "website" ? "visitor" : kind === "tool" ? "installation" : "actor",
      ...(kind === "website" ? { session_id: `s-${Math.floor(i / 2)}` } : {}),
      properties:
        kind === "website"
          ? {
              path: i % 2 ? "/docs" : "/",
              referrer: "Direct",
              utm_source: i % 2 ? "newsletter" : "organic",
              ...(i % 2 ? { utm_campaign: "launch" } : {}),
            }
          : kind === "tool"
            ? {
                command: i % 2 ? "build" : "deploy",
                duration_ms: 100 + i * 10,
                success: i % 2 === 0,
                version: "1.0.0",
                os: "linux",
                arch: "aarch64",
              }
            : {
                variant: [true, "true", 42, "42", false, 0, ""][i % 7],
                note: `long-value-${"x".repeat(600)}`,
                success: "false",
                duration_ms: "0",
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
  await select(page, "Select project", web.name);
  await expect(page.getByRole("heading", { name: web.name })).toBeVisible();
  await expect(page.getByText("Top events", { exact: true }).first()).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("32");
  await select(page, "Select project", tool.name);
  await expect(page.locator(".metrics").getByText("Events", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog");
  const name = `UI product ${Date.now()}`;
  await dialog.getByLabel("Project name").fill(name);
  await expect(dialog.getByLabel("First source type")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Project name")).toHaveValue(name);
  await page.getByLabel("Retention (days)").fill("14");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Project changes saved.")).toBeVisible();
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
  await expect(page.getByText("No events in this range")).toBeVisible();
});
test("mobile website and tool layouts do not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  for (const p of [web, tool]) {
    await select(page, "Select project", p.name);
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

    retention_days: 30,
  });
  const { key } = await admin(`/products/${p.id}/keys`, { label: "Tracker" });
  const fixture = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch: () =>
      new Response(
        `<html><body>Tracker fixture<script type="module">import {startBrowserTracker} from '${dashboard}/tracker.js'; window.tracker=startBrowserTracker({endpoint:'${apiUrl}',key:'${key}',identity:'persistent',identityScope:'${p.id}',campaigns:['utm_source','utm_campaign']});</script></body></html>`,
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
  await expect(page.getByRole("heading", { name: "Explore events" })).toBeVisible();
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
  await page.getByRole("button", { name: "New project" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  expect(
    await page.getByRole("dialog").evaluate((el) => getComputedStyle(el).backgroundColor),
  ).toBe("rgb(18, 20, 22)");
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
    "rgb(18, 20, 22)",
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
  await expect(page.getByRole("heading", { name: "Explore events" })).toBeVisible();
  await select(page, "Select project", tool.name);
  await select(page, "Measure", "Numeric average");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.locator(".explore-summary strong")).toHaveText("255 ms");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("website breakdown links preserve product and dates across reload and history", async ({
  page,
}) => {
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await select(page, "Breakdown", "Pages");
  const docs = page.getByRole("link", { name: "Explore /docs", exact: true });
  await expect(docs).toContainText("50%");
  const clicked = new URL((await docs.getAttribute("href")) ?? "", dashboard);
  const selection = JSON.parse(clicked.searchParams.get("drilldown") ?? "null");
  expect(selection.productId).toBe(web.id);
  expect(selection.filter).toEqual({ property: "path", value: "/docs" });
  const request = page.waitForRequest(
    (r) => r.url().endsWith(`/products/${web.id}/query`) && r.postDataJSON().filters?.length === 1,
  );
  await docs.click();
  expect((await request).postDataJSON()).toMatchObject({
    from: selection.from,
    to: selection.to,
    filters: [{ property: "path", op: "eq", value: "/docs" }],
  });
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Date range" })).toContainText("Fixed dates");
  await expect(page.getByLabel("Typed value")).toHaveValue('"/docs"');
  await page.screenshot({ path: test.info().outputPath("website-drilldown.png"), fullPage: true });
  await page.evaluate((id) => localStorage.setItem("piko:product", id), tool.id);
  await page.reload();
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(web.name);
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  const refresh = page.waitForRequest((r) => r.url().endsWith(`/products/${web.id}/query`));
  await page.getByRole("button", { name: "Refresh analytics" }).click();
  expect((await refresh).postDataJSON()).toMatchObject({ from: selection.from, to: selection.to });
  await page.getByRole("link", { name: "Clear selection", exact: true }).click();
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await page.goBack();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await expect(page.getByLabel("Typed value")).toHaveValue('"/docs"');
  await page.goForward();
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await page.goBack();
  await select(page, "Select project", tool.name);
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await expect(page.getByRole("region", { name: "Overview selection" })).not.toBeVisible();
  expect(new URL(page.url()).searchParams.has("drilldown")).toBe(false);
});

test("breakdown choices drill into referrers and campaigns, with missing values informational", async ({
  page,
}) => {
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await select(page, "Breakdown", "Referrers");
  await page.getByRole("link", { name: "Explore Direct", exact: true }).click();
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await expect(page.getByLabel("Property", { exact: true })).toHaveValue("referrer");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await select(page, "Breakdown", "Campaign sources");
  await page.getByRole("link", { name: "Explore newsletter", exact: true }).click();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await expect(page.getByLabel("Property", { exact: true })).toHaveValue("utm_source");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await select(page, "Breakdown", "Campaigns");
  await expect(page.getByText("Not provided", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Explore Not provided" })).toHaveCount(0);
  await page.getByRole("link", { name: "Explore launch", exact: true }).click();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await select(page, "Date range", "Last 7 days");
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  expect(new URL(page.url()).searchParams.has("drilldown")).toBe(false);
  await page.goBack();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await expect(page.getByLabel("Property", { exact: true })).toHaveValue("utm_campaign");
});

test("tool command and version links work in the narrow dark layout", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await appearance(page, "Dark");
  await select(page, "Select project", tool.name);
  await select(page, "Breakdown", "Versions");
  await expect(page.getByRole("link", { name: "Explore 1.0.0", exact: true })).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("tool-breakdown-dark-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("link", { name: "Explore 1.0.0", exact: true }).click();
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await expect(page.getByLabel("Property", { exact: true })).toHaveValue("version");
  await page.goBack();
  await select(page, "Breakdown", "Commands");
  await page.getByRole("link", { name: "Explore build", exact: true }).click();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Event", exact: true })).toContainText(
    "All events",
  );
  await select(page, "Measure", "Numeric average");
  await page.getByRole("button", { name: "Run query" }).click();
  await expect(page.locator(".explore-summary strong")).toHaveText("260 ms");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("generic client links use envelope filters and shares include groups outside the top twelve", async ({
  page,
}) => {
  await openWorkspace(page);
  await select(page, "Select project", generic.name);
  await select(page, "Breakdown", "Clients");
  const source = page.getByRole("link", { name: "Explore sdk", exact: true });
  await expect(source).toContainText("25%");
  const request = page.waitForRequest(
    (r) => r.url().endsWith(`/products/${generic.id}/query`) && r.postDataJSON().source === "sdk",
  );
  await source.click();
  expect((await request).postDataJSON()).toMatchObject({ source: "sdk", filters: [] });
  await expect(page.getByText("across 8 matching events")).toBeVisible();
  await page.getByRole("button", { name: "Remove client filter" }).click();
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await page.getByRole("link", { name: "Explore activity", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Event", exact: true })).toContainText(
    "activity",
  );
  await expect(page.getByText("across 32 matching events")).toBeVisible();
});

test("drilldown URLs preserve primitive property types and reject unsafe or incomplete context", async ({
  page,
}) => {
  const bounds = range();
  for (const [value, total] of [
    [true, 5],
    ["true", 5],
    [42, 5],
    ["42", 5],
    [false, 4],
    [0, 4],
    ["", 4],
  ] as const) {
    const drilldown = { productId: generic.id, ...bounds, filter: { property: "variant", value } };
    const request = page.waitForRequest(
      (r) =>
        r.url().endsWith(`/products/${generic.id}/query`) && r.postDataJSON().filters?.length === 1,
    );
    await page.goto(`/explore?drilldown=${encodeURIComponent(JSON.stringify(drilldown))}`);
    expect((await request).postDataJSON().filters).toEqual([
      { property: "variant", op: "eq", value },
    ]);
    await expect(page.getByText(`across ${total} matching events`)).toBeVisible();
    await expect(page.getByLabel("Typed value")).toHaveValue(JSON.stringify(value));
    await page.getByRole("button", { name: "Run query" }).click();
    await expect(page.getByText(`across ${total} matching events`)).toBeVisible();
  }
  const requests: string[] = [];
  page.on("request", (r) => {
    if (r.url().endsWith("/query")) requests.push(r.url());
  });
  for (const drilldown of [
    { productId: generic.id },
    { productId: generic.id, ...bounds, filter: { property: "variant", value: null } },
    { productId: generic.id, from: bounds.to, to: bounds.from },
    { productId: generic.id, from: "2020-01-01T00:00:00.000Z", to: bounds.to },
    { productId: crypto.randomUUID(), ...bounds },
  ]) {
    await page.goto(`/explore?drilldown=${encodeURIComponent(JSON.stringify(drilldown))}`);
    await expect(
      page.getByRole("heading", { name: "This selection is unavailable" }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear selection", exact: true })).toBeVisible();
  }
  expect(requests).toEqual([]);
});

test("secondary breakdown choices show pending and retry states without stale rows", async ({
  page,
}) => {
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await select(page, "Breakdown", "Referrers");
  await expect(page.getByRole("link", { name: "Explore Direct", exact: true })).toBeVisible();
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failedOnce = false;
  await page.route(`**/products/${web.id}/query`, async (route) => {
    if (route.request().postDataJSON().group_by === "property:utm_source" && !failedOnce) {
      failedOnce = true;
      await pending;
      await route.fulfill({ status: 503, json: { error: "Temporary breakdown failure" } });
    } else {
      await route.continue();
    }
  });
  try {
    await select(page, "Breakdown", "Campaign sources");
    await expect(page.getByRole("status", { name: "Loading breakdown" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Explore Direct", exact: true })).not.toBeVisible();
    release();
    await expect(page.getByText("Temporary breakdown failure")).toBeVisible();
    await page.getByRole("button", { name: "Try again", exact: true }).click();
    await expect(page.getByRole("link", { name: "Explore newsletter", exact: true })).toBeVisible();
    await expect(page.getByText("Temporary breakdown failure")).not.toBeVisible();
  } finally {
    release();
  }
});

test("only validated Explore search can change the workspace context", async ({ page }) => {
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await page.goto("/?drilldown=true");
  await expect(page.getByRole("heading", { name: web.name })).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("32");
  const malformed = encodeURIComponent(
    JSON.stringify({ productId: tool.id, from: "bad", to: "bad" }),
  );
  await page.goto(`/settings?drilldown=${malformed}`);
  await expect(page.getByLabel("Project name")).toHaveValue(web.name);
  const queries: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith("/query")) queries.push(request.url());
  });
  await page.goto(`/explore?drilldown=${malformed}`);
  await expect(page.getByRole("heading", { name: "This selection is unavailable" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("piko:product"))).toBe(web.id);
  expect(queries).toEqual([]);
  await page.getByRole("link", { name: "Clear selection", exact: true }).click();
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Select project" })).toContainText(web.name);
});

async function inspectorJson(page: Page) {
  const inspector = page.getByRole("dialog");
  await inspector.getByRole("tab", { name: "JSON", exact: true }).click();
  return JSON.parse((await inspector.getByRole("tabpanel").locator("pre").textContent()) ?? "null");
}

test("event inspector exposes context, metadata and JSON with keyboard and clipboard support", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  const stream = page.locator(".event-card");
  const opener = stream.getByRole("button", { name: "Inspect page_view", exact: true }).first();
  await expect(stream.locator("tbody tr").first()).toContainText("Direct");
  await expect(stream.locator("tbody tr").first()).toContainText("Visitor");
  await opener.press("Enter");
  const inspector = page.getByRole("dialog", { name: "page_view", exact: true });
  await expect(inspector).toBeVisible();
  const event = await inspectorJson(page);
  expect(event.name).toBe("page_view");
  await inspector.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(JSON.stringify(event, null, 2));
  await inspector.getByRole("tab", { name: "Metadata", exact: true }).click();
  for (const value of [
    event.event_id,
    event.actor_id,
    event.session_id,
    new Date(event.timestamp).toISOString(),
    new Date(event.received_at).toISOString(),
  ]) {
    await expect(inspector.getByRole("tabpanel")).toContainText(value);
  }
  await page.keyboard.press("Escape");
  await expect(inspector).not.toBeVisible();
  await expect(opener).toBeFocused();
  await opener.click();
  await expect(inspector.getByRole("button", { name: "Newer event", exact: true })).toBeDisabled();
  await inspector.getByRole("button", { name: "Older event", exact: true }).press("Enter");
  await expect(inspector.getByRole("button", { name: "Older event", exact: true })).toBeFocused();
  const older = await inspectorJson(page);
  expect(older.event_id).not.toBe(event.event_id);
  expect(older.timestamp).toBeLessThan(event.timestamp);
  await inspector.getByRole("button", { name: "Newer event", exact: true }).click();
  expect((await inspectorJson(page)).event_id).toBe(event.event_id);
  await inspector.getByRole("tab", { name: "Properties", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("event-inspector-website.png") });
});

test("property inspection filters the server using applied context and retains boolean type", async ({
  page,
}) => {
  await openWorkspace(page);
  await select(page, "Select project", tool.name);
  await select(page, "Breakdown", "Commands");
  await page.getByRole("link", { name: "Explore build", exact: true }).click();
  await select(page, "Measure", "Numeric average");
  const stream = page.locator(".event-card");
  await expect(stream.locator("tbody tr").first()).toContainText("build");
  await expect(stream.locator("tbody tr").first()).toContainText("110 ms");
  await stream.getByRole("button", { name: "Inspect command_run", exact: true }).first().click();
  const inspector = page.getByRole("dialog");
  await inspector.getByLabel("Search properties").fill("SUCC");
  await expect(inspector.getByRole("tabpanel").getByText("boolean", { exact: true })).toBeVisible();
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith(`/products/${tool.id}/query`) &&
      r.postDataJSON().filters?.[0]?.property === "success",
  );
  await inspector.getByRole("button", { name: "Filter by success", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    measure: "count",
    page: 0,
    filters: [{ property: "success", op: "eq", value: false }],
  });
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("combobox", { name: "Measure", exact: true })).toContainText(
    "Event count",
  );
  await expect(page.getByLabel("Typed value")).toHaveValue("false");
  await expect(page.getByLabel("Typed value")).toBeFocused();
  await expect(page.getByText("across 16 matching events")).toBeVisible();
});

test("event pagination fetches server pages and keeps charts stable during loading", async ({
  page,
}) => {
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  const stream = page.locator(".event-card");
  await expect(stream.getByRole("button", { name: "Inspect page_view", exact: true })).toHaveCount(
    15,
  );
  const sizeRequest = page.waitForRequest(
    (r) => r.url().endsWith(`/products/${web.id}/query`) && r.postDataJSON().page_size === 30,
  );
  await select(page, "Rows per page", "30 rows");
  const requested = (await sizeRequest).postDataJSON();
  expect(requested).toMatchObject({ page: 0, page_size: 30 });
  await expect(stream.getByRole("button", { name: "Inspect page_view", exact: true })).toHaveCount(
    30,
  );
  let release = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  let failedOnce = false;
  await page.route(`**/products/${web.id}/query`, async (route) => {
    if (route.request().postDataJSON().page === 1 && !failedOnce) {
      failedOnce = true;
      await pending;
      await route.fulfill({ status: 503, json: { error: "Temporary event page failure" } });
    } else {
      await route.continue();
    }
  });
  try {
    await stream.getByRole("button", { name: "Next", exact: true }).click();
    await expect(stream).toHaveAttribute("aria-busy", "true");
    await expect(stream.getByRole("status", { name: "Loading events", exact: true })).toBeVisible();
    await expect(page.getByText("Results over time", { exact: true })).toBeVisible();
    await expect(
      stream.getByRole("button", { name: "Inspect page_view", exact: true }),
    ).toHaveCount(0);
    await expect(stream.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    release();
    await expect(stream.getByRole("alert")).toContainText("Temporary event page failure");
    const retried = page.waitForRequest((r) => r.url().endsWith(`/products/${web.id}/query`));
    await stream.getByRole("button", { name: "Try again", exact: true }).click();
    expect((await retried).postDataJSON()).toMatchObject({
      page: 1,
      page_size: 30,
      from: requested.from,
      to: requested.to,
    });
    await expect(
      stream.getByRole("button", { name: "Inspect page_view", exact: true }),
    ).toHaveCount(2);
    await expect(stream.getByText("Page 2 of 2", { exact: true })).toBeVisible();
    await expect(stream.getByRole("button", { name: "Next", exact: true })).toBeDisabled();
    await select(page, "Rows per page", "15 rows");
    await expect(stream.getByText("Page 1 of 3", { exact: true })).toBeVisible();
  } finally {
    release();
  }
});

test("inspector preserves numeric and string values and wraps long properties on mobile", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.setViewportSize({ width: 390, height: 844 });
  await openWorkspace(page);
  await appearance(page, "Dark");
  await select(page, "Select project", generic.name);
  await page.goto("/explore");
  const stream = page.locator(".event-card");
  await expect(stream.locator("tbody tr").first()).not.toContainText("0 ms");
  for (const [index, value, total] of [
    [2, 42, 5],
    [3, "42", 5],
    [5, 0, 4],
    [6, "", 4],
  ] as const) {
    await page.goto("/explore");
    await stream.getByRole("button", { name: "Inspect activity", exact: true }).nth(index).click();
    const inspector = page.getByRole("dialog");
    await inspector.getByLabel("Search properties").fill("variant");
    await inspector.getByRole("button", { name: "Copy variant", exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe(JSON.stringify(value));
    const request = page.waitForRequest(
      (r) =>
        r.url().endsWith(`/products/${generic.id}/query`) &&
        r.postDataJSON().filters?.[0]?.property === "variant",
    );
    await inspector.getByRole("button", { name: "Filter by variant", exact: true }).click();
    expect((await request).postDataJSON().filters).toEqual([
      { property: "variant", op: "eq", value },
    ]);
    await expect(page.getByText(`across ${total} matching events`)).toBeVisible();
  }
  await page.goto("/explore");
  await stream.getByRole("button", { name: "Inspect activity", exact: true }).first().click();
  const inspector = page.getByRole("dialog");
  await inspector.getByLabel("Search properties").fill("note");
  await expect(inspector.getByRole("tabpanel")).toContainText("x".repeat(600));
  expect(await inspector.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: test.info().outputPath("event-inspector-mobile.png") });
  await inspector.getByLabel("Search properties").fill("a-property-that-does-not-exist");
  await expect(inspector.getByRole("button", { name: /^Filter by / })).toHaveCount(0);
});

test("clipboard failures are visible and inspector scope ends when the product changes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, "writeText", {
      configurable: true,
      value: () => Promise.reject(new Error("Clipboard denied")),
    });
  });
  await openWorkspace(page);
  await select(page, "Select project", web.name);
  await page.goto("/explore");
  await page
    .locator(".event-card")
    .getByRole("button", { name: "Inspect page_view", exact: true })
    .first()
    .click();
  const inspector = page.getByRole("dialog");
  await inspector.getByRole("tab", { name: "JSON", exact: true }).click();
  await inspector.getByRole("button", { name: "Copy JSON", exact: true }).click();
  await expect(inspector.getByRole("alert")).toContainText(/copy|clipboard/i);
  await page.keyboard.press("Escape");
  await select(page, "Select project", tool.name);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.locator(".event-card").getByRole("button", { name: "Inspect page_view", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator(".event-card").getByRole("button", { name: "Inspect command_run", exact: true }),
  ).toHaveCount(15);
});

test("workspace stays usable when browser storage and cookies are blocked", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Storage blocked", "SecurityError");
      },
    });
    Object.defineProperty(document, "cookie", {
      get() {
        return "";
      },
      set() {
        throw new DOMException("Cookies blocked", "SecurityError");
      },
    });
  });
  await openWorkspace(page);
  await expect(page.getByRole("combobox", { name: "Select project" })).toBeEnabled({
    timeout: 3000,
  });
  await select(page, "Select project", tool.name);
  await select(page, "Date range", "Last 7 days");
  await expect(page.locator(".metric-value").first()).toHaveText("32");
  await page.getByRole("button", { name: "Toggle Sidebar", exact: true }).click();
  await expect(page.locator('[data-slot="sidebar"][data-state]')).toHaveAttribute(
    "data-state",
    "collapsed",
  );
  await appearance(page, "Dark");
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog");
  const name = `Storage denied ${Date.now()}`;
  await dialog.getByLabel("Project name").fill(name);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Project name")).toHaveValue(name);
  expect(errors).toEqual([]);
});
