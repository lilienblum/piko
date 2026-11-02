import { expect, test, type Page } from "@playwright/test";
import { Channel, type ChannelMessage } from "tako.sh/client";
import type { ChangeEnvelope } from "../apps/dashboard/src/lib/change-envelope";

const endpoint = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
test.skip(process.env.PIKO_REALTIME !== "1", "Requires the two live Tako apps (PIKO_REALTIME=1)");

type Fixture = { id: string; name: string; key: string };
async function admin(path: string, body?: unknown) {
  const response = await fetch(`${endpoint}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function fixture(kind: "website" | "tool", count: number): Promise<Fixture> {
  const product = await admin("/products", {
    name: `Live ${kind} ${crypto.randomUUID().slice(0, 8)}`,

    retention_days: 30,
  });
  const { key } = await admin(`/products/${product.id}/keys`, { label: "Realtime test" });
  const result = { ...product, key };
  await ingest(result, kind, count);
  return result;
}
function event(kind: "website" | "tool") {
  return {
    event_id: crypto.randomUUID(),
    name: kind === "website" ? "page_view" : "command_run",
    source: kind === "website" ? "browser" : "cli",
    actor_id: crypto.randomUUID(),
    identity_kind: kind === "website" ? "visitor" : "installation",
    properties:
      kind === "website" ? { path: "/live" } : { command: "build", success: true, duration_ms: 42 },
  };
}
async function send(product: Fixture, events: ReturnType<typeof event>[]) {
  const response = await fetch(`${endpoint}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${product.key}`, "content-type": "application/json" },
    body: JSON.stringify({ events }),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function ingest(product: Fixture, kind: "website" | "tool", count = 1) {
  return send(
    product,
    Array.from({ length: count }, () => event(kind)),
  );
}
async function open(page: Page, product: Fixture, path = "/") {
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), product.id);
  const connected = page.waitForResponse(
    (response) => response.url().includes("/_tako/channels/") && response.ok(),
  );
  await page.goto(path);
  await connected;
  await expect(page.locator(".live-status")).toHaveCount(0);
}

test("committed website events refresh without replacing charts; retries and other products stay scoped", async ({
  page,
}) => {
  const web = await fixture("website", 1);
  const other = await fixture("tool", 1);
  await open(page, web);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("1");
  await page.waitForTimeout(2200); // Settle the initial connection reconciliation and coalescing window.
  let queries = 0;
  page.on("request", (request) => {
    if (request.url().includes(`/products/${web.id}/query`)) queries++;
  });
  await ingest(other, "tool");
  await page.waitForTimeout(2000);
  expect(queries).toBe(0);
  const chart = await page.locator(".activity-widget .analytics-plot").first().elementHandle();
  const item = event("website");
  const result = await send(web, [item]);
  expect(result.accepted).toBe(1);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2", {
    timeout: 10000,
  });
  expect(await chart?.evaluate((element) => element.isConnected)).toBe(true);
  const beforeRetry = queries;
  const retry = await send(web, [item]);
  expect(retry.duplicates).toBe(1);
  await page.waitForTimeout(2000);
  expect(queries).toBe(beforeRetry);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
});

test("Explore announces new CLI data while preserving pagination, draft, and inspection", async ({
  page,
}) => {
  const tool = await fixture("tool", 31);
  await open(page, tool, "/explore");
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  // Reconcile any changes missed before the initial connection opened.
  if (await page.getByRole("button", { name: "Refresh results" }).isVisible()) {
    await page.getByRole("button", { name: "Refresh results" }).click();
    await expect(page.getByText("New data available", { exact: true })).toBeHidden();
  }
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await page.getByLabel("Property", { exact: true }).fill("success");
  await page.getByLabel("Typed value").fill("true");
  await page.getByRole("button", { name: "Inspect command_run", exact: true }).first().click();
  const details = page.getByRole("dialog");
  await expect(details).toBeVisible();
  const original = await details.textContent();
  const queryBox = await page.locator(".query-builder").boundingBox();
  await ingest(tool, "tool");
  await expect(page.getByText("New data available", { exact: true })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await expect(page.getByText("across 31 matching events")).toBeVisible();
  expect(await details.textContent()).toBe(original);
  expect(await page.locator(".query-builder").boundingBox()).toEqual(queryBox);
  await page.keyboard.press("Escape");
  await expect(details).toBeHidden();
  await expect(page.getByLabel("Typed value")).toHaveValue("true");
  await page.getByRole("button", { name: "Refresh results" }).scrollIntoViewIfNeeded();
  const refreshBox = await page.locator(".query-builder").boundingBox();
  const row = await page.locator(".event-card tbody tr").first().elementHandle();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/products/*/query", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.getByRole("button", { name: "Refresh results" }).click();
    await expect(page.getByRole("button", { name: "Refresh results" })).toBeDisabled();
    expect(await row?.evaluate((element) => element.isConnected)).toBe(true);
    expect(await page.locator(".query-builder").boundingBox()).toEqual(refreshBox);
    await expect(page.getByText("Page 2 of 3")).toBeVisible();
  } finally {
    release();
  }
  await expect(page.getByText("across 32 matching events")).toBeVisible();
  await expect(page.getByText("Page 2 of 3")).toBeVisible();
  await expect(page.getByText("New data available", { exact: true })).toBeHidden();
});

test("reconnect catches up committed data after an interrupted SSE stream", async ({ page }) => {
  const web = await fixture("website", 1);
  let connections = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_tako/channels/**", async (route) => {
    connections++;
    if (connections === 1) {
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": connected\n\n",
      });
      return;
    }
    await gate;
    await route.continue();
  });
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), web.id);
  await page.goto("/");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("1");
  await expect.poll(() => connections, { timeout: 10000 }).toBeGreaterThanOrEqual(2);
  await ingest(web, "website", 3);
  release();
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("4", {
    timeout: 15000,
  });
});

test("public ingestion keys cannot publish channel refresh notifications", async ({ request }) => {
  const web = await fixture("website", 1);
  for (const authorization of [undefined, `Bearer ${web.key}`]) {
    const response = await request.post("/_piko/changes", {
      headers: authorization ? { authorization } : {},
      data: { version: 1, products: [web.id] },
    });
    expect(response.status()).toBe(401);
  }
  const response = await request.get("/_piko/runtime");
  expect(await response.json()).toEqual({ live: true });
});

function listen(baseUrl?: string, lastEventId?: string) {
  const subscription = new Channel("analytics-changes").subscribe({
    baseUrl: baseUrl ?? "http://127.0.0.1:3000",
    lastEventId,
  });
  const stream = subscription.raw as EventTarget;
  const messages: ChannelMessage<ChangeEnvelope>[] = [];
  let opened = false;
  stream.addEventListener("open", () => {
    opened = true;
  });
  stream.addEventListener("message", (event) => {
    messages.push(JSON.parse((event as MessageEvent).data));
  });
  return { messages, isOpen: () => opened, close: subscription.close };
}

test("ephemeral hints reach connected subscribers without replaying disconnected history", async ({
  baseURL,
}) => {
  const observer = listen(baseURL);
  const first = listen(baseURL);
  const subscriptions = [observer, first];
  try {
    await expect.poll(() => observer.isOpen() && first.isOpen()).toBe(true);
    const live = await fixture("website", 1);
    for (const stream of subscriptions)
      await expect
        .poll(() => stream.messages.some((message) => message.data.products?.includes(live.id)))
        .toBe(true);
    first.close();
    const missed = await fixture("tool", 1);
    // The observer proves publication finished while the other subscriber was absent.
    await expect
      .poll(() => observer.messages.some((message) => message.data.products?.includes(missed.id)))
      .toBe(true);
    // Existing clients may reconnect with a cursor from the previous durable channel.
    const reconnected = listen(baseURL, "1");
    subscriptions.push(reconnected);
    await expect.poll(reconnected.isOpen).toBe(true);
    const fresh = await fixture("website", 1);
    await expect
      .poll(() => reconnected.messages.some((message) => message.data.products?.includes(fresh.id)))
      .toBe(true);
    expect(reconnected.messages.some((message) => message.data.products?.includes(missed.id))).toBe(
      false,
    );
    for (const message of subscriptions.flatMap((stream) => stream.messages)) {
      expect(message.id).toBe("");
      expect(message.channel).toBe("analytics-changes");
      expect(message.type).toBe("changed");
      expect(Object.keys(message.data).sort()).toEqual(["products", "version"]);
    }
  } finally {
    for (const stream of subscriptions) stream.close();
  }
});

test("Explore catches up changes between its initial query and first live connection", async ({
  page,
  baseURL,
}) => {
  const observer = listen(baseURL);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/_tako/channels/**", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await expect.poll(observer.isOpen).toBe(true);
    const tool = await fixture("tool", 1);
    await expect
      .poll(() => observer.messages.some((message) => message.data.products?.includes(tool.id)))
      .toBe(true);
    await page.addInitScript((id) => localStorage.setItem("piko:product", id), tool.id);
    await page.goto("/explore");
    await expect(page.getByText("across 1 matching events")).toBeVisible();
    const before = observer.messages.length;
    await ingest(tool, "tool", 2);
    await expect
      .poll(() =>
        observer.messages.slice(before).some((message) => message.data.products?.includes(tool.id)),
      )
      .toBe(true);
    release();
    await expect(page.getByRole("button", { name: "Refresh results" })).toBeVisible();
    await expect(page.getByText("across 1 matching events")).toBeVisible();
    await page.getByRole("button", { name: "Refresh results" }).click();
    await expect(page.getByText("across 3 matching events")).toBeVisible();
  } finally {
    release();
    observer.close();
  }
});

test("a transient runtime capability error retries and enables live updates", async ({ page }) => {
  const web = await fixture("website", 1);
  let attempts = 0;
  await page.route("**/_piko/runtime", async (route) => {
    attempts++;
    if (attempts === 1) await route.fulfill({ status: 503, body: "Temporary outage" });
    else await route.continue();
  });
  await open(page, web);
  expect(attempts).toBeGreaterThanOrEqual(2);
  await ingest(web, "website");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2", {
    timeout: 10000,
  });
});
