import { expect, test, type Page, type Request } from "@playwright/test";

const apiUrl = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
let product: { id: string; name: string };
let other: { id: string; name: string };
async function admin(path: string, body?: unknown) {
  const response = await fetch(`${apiUrl}/api${path}`, {
    method: body ? "POST" : "GET",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function hold(page: Page, pattern: string, matches = (_: Request) => true) {
  let release = () => {};
  let active = true;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(pattern, async (route) => {
    if (active && matches(route.request())) await gate;
    await route.continue();
  });
  return () => {
    active = false;
    release();
  };
}

test.beforeAll(async () => {
  const suffix = Date.now();
  product = await admin("/products", {
    name: `Loading website ${suffix}`,
    kind: "website",
    retention_days: 30,
  });
  other = await admin("/products", {
    name: `Loading tool ${suffix}`,
    kind: "tool",
    retention_days: 30,
  });
  const { key } = await admin(`/products/${product.id}/keys`, { label: "Loading fixture" });
  const response = await fetch(`${apiUrl}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      events: Array.from({ length: 8 }, (_, i) => ({
        event_id: crypto.randomUUID(),
        name: "page_view",
        source: "browser",
        actor_id: `visitor-${i}`,
        identity_kind: "visitor",
        properties: { path: i % 2 ? "/docs" : "/", referrer: "Direct", utm_source: "newsletter" },
      })),
    }),
  });
  expect(response.ok).toBe(true);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => {
    localStorage.setItem("piko:product", id);
    localStorage.setItem("piko:theme", "light");
  }, product.id);
});

test("workspace bootstrap keeps navigation visible with honest pending product selection", async ({
  page,
}) => {
  const release = await hold(page, "**/api/products");
  try {
    await page.goto("/");
    await expect(
      page.getByRole("status", { name: "Loading workspace", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Overview", exact: true })).toBeVisible();
    await expect(page.getByRole("combobox", { name: "Select product" })).toBeDisabled();
    await expect(page.getByText("No products yet", { exact: true })).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath("workspace-loading.png") });
  } finally {
    release();
  }
  await expect(page.getByRole("combobox", { name: "Select product" })).toContainText(product.name);
  await expect(
    page.getByRole("status", { name: "Loading workspace", exact: true }),
  ).not.toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("8");
});

test("overview placeholders keep card geometry and breakdown loading stays local", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".metric-value").first()).toHaveText("8");
  const chart = await page.locator(".chart-card").boundingBox();
  const metric = await page.locator(".metric-card").first().boundingBox();
  const release = await hold(page, "**/api/products/*/query");
  try {
    await page.getByRole("button", { name: "Refresh analytics" }).click();
    const pending = page.getByRole("status", { name: "Loading overview", exact: true });
    await expect(pending).toBeVisible();
    await expect(pending.locator(".metric-card")).toHaveCount(4);
    await expect(page.getByRole("button", { name: "Refresh analytics" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    const pendingChart = await pending.locator(".chart-card").boundingBox();
    const pendingMetric = await pending.locator(".metric-card").first().boundingBox();
    if (!chart || !metric || !pendingChart || !pendingMetric)
      throw new Error("Expected chart and metric geometry");
    expect(Math.abs(pendingChart.y - chart.y)).toBeLessThanOrEqual(12);
    expect(Math.abs(pendingChart.height - chart.height)).toBeLessThanOrEqual(12);
    expect(Math.abs(pendingMetric.height - metric.height)).toBeLessThanOrEqual(12);
    await page.screenshot({ path: test.info().outputPath("overview-loading.png") });
  } finally {
    release();
  }
  await expect(page.locator(".metric-value").first()).toHaveText("8");
  const releaseBreakdown = await hold(
    page,
    "**/api/products/*/query",
    (r) => r.postDataJSON().group_by === "property:utm_source",
  );
  try {
    await page.getByRole("tab", { name: "Sources", exact: true }).click();
    await expect(
      page.getByRole("status", { name: "Loading breakdown", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".metric-value").first()).toHaveText("8");
    await expect(
      page.getByRole("status", { name: "Loading overview", exact: true }),
    ).not.toBeVisible();
  } finally {
    releaseBreakdown();
  }
  await expect(page.getByRole("link", { name: "Explore newsletter", exact: true })).toBeVisible();
});

test("explore loading matches results and pending query recovers after error", async ({ page }) => {
  const release = await hold(page, "**/api/products/*/query");
  try {
    await page.goto("/explore");
    const pending = page.getByRole("status", { name: "Loading query results", exact: true });
    await expect(pending).toBeVisible();
    await expect(pending.locator(".metrics")).toHaveCount(0);
    await expect(pending.locator(".explore-summary")).toBeVisible();
    await expect(pending.locator(".explore-charts")).toBeVisible();
    await expect(page.getByRole("button", { name: "Run query", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Run query", exact: true })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByText("across 0 matching events")).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath("explore-loading.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.getByRole("button", { name: "Appearance", exact: true }).click();
    await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await pending
        .locator('[data-slot="skeleton"]')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe("none");
    await page.screenshot({ path: test.info().outputPath("explore-loading-mobile.png") });
  } finally {
    release();
  }
  await expect(page.getByText("across 8 matching events")).toBeVisible();
  await expect(page.getByRole("button", { name: "Run query", exact: true })).toBeEnabled();
  await page.route(
    "**/api/products/*/query",
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Query capacity reached" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Run query", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Query capacity reached");
  await expect(page.getByRole("button", { name: "Run query", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("across 8 matching events")).toBeVisible();
});

test("key loading never flashes empty and failed requests have a working local retry", async ({
  page,
}) => {
  const release = await hold(page, "**/api/products/*/keys");
  try {
    await page.goto("/settings");
    await expect(page.getByText("Product details", { exact: true })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath("keys-pending.png") });
    await expect(
      page.getByText("No keys yet. Create one to start sending events."),
    ).not.toBeVisible();
    await expect(
      page.getByRole("status", { name: "Loading ingestion keys", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Create ingestion key", exact: true }),
    ).toBeDisabled();
  } finally {
    release();
  }
  await expect(page.getByText("Loading fixture", { exact: true })).toBeVisible();
  let keysUnavailable = true;
  await page.route(`**/api/products/${other.id}/keys`, (route) =>
    keysUnavailable
      ? route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: "Keys temporarily unavailable" }),
        })
      : route.continue(),
  );
  await page.getByRole("combobox", { name: "Select product" }).click();
  await page.getByRole("option", { name: other.name, exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Keys temporarily unavailable");
  await expect(page.getByText("Loading fixture", { exact: true })).not.toBeVisible();
  await expect(
    page.getByText("No keys yet. Create one to start sending events."),
  ).not.toBeVisible();
  keysUnavailable = false;
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("No keys yet. Create one to start sending events.")).toBeVisible();
});

test("settings mutations show the active operation and retain a key after list refresh fails", async ({
  page,
}) => {
  await page.goto("/settings");
  await expect(page.getByText("Loading fixture", { exact: true })).toBeVisible();
  const releaseSave = await hold(
    page,
    `**/api/products/${product.id}`,
    (r) => r.method() === "PATCH",
  );
  try {
    await page.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(page.getByRole("button", { name: "Saving…", exact: true })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Create ingestion key", exact: true }),
    ).toBeDisabled();
  } finally {
    releaseSave();
  }
  await expect(page.getByText("Product changes saved.", { exact: true })).toBeVisible();
  const releaseCreate = await hold(
    page,
    `**/api/products/${product.id}/keys`,
    (r) => r.method() === "POST",
  );
  try {
    await page.getByLabel("New key label").fill("Loading mutation");
    await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
    await expect(page.getByRole("button", { name: "Creating key…", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Save changes", exact: true })).toBeDisabled();
    await page.route(
      `**/api/products/${product.id}/keys`,
      async (route) => {
        if (route.request().method() === "GET")
          await route.fulfill({
            status: 503,
            contentType: "application/json",
            body: JSON.stringify({ error: "Key list unavailable" }),
          });
        else await route.fallback();
      },
      { times: 1 },
    );
  } finally {
    releaseCreate();
  }
  await expect(page.getByText("Copy your new key", { exact: true })).toBeVisible();
  await expect(page.locator(".new-key")).not.toHaveText("");
  await expect(page.getByRole("alert").filter({ hasText: "Key list unavailable" })).toBeVisible();
  await page.route(
    `**/api/products/${product.id}/keys`,
    async (route) => {
      const response = await route.fetch();
      const keys: { id: string; label: string; prefix: string }[] = await response.json();
      const existing = keys.find((key) => key.label === "Loading fixture");
      const created = keys.find((key) => key.label === "Loading mutation");
      if (!existing || !created) throw new Error("Expected both key fixtures");
      existing.prefix = created.prefix;
      await route.fulfill({ response, json: keys });
    },
    { times: 1 },
  );
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.getByText("Loading mutation", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Revoke Loading fixture", exact: true }).click();
  await page.getByRole("button", { name: "Revoke key", exact: true }).click();
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(page.locator(".new-key")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create ingestion key", exact: true }),
  ).toBeEnabled();
  await page.route(
    `**/api/products/${product.id}/keys/*`,
    (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Revocation temporarily unavailable" }),
      }),
    { times: 1 },
  );
  await page.getByRole("button", { name: "Revoke Loading mutation", exact: true }).click();
  await page.getByRole("button", { name: "Revoke key", exact: true }).click();
  await expect(page.getByRole("alertdialog").getByRole("alert")).toContainText(
    "Revocation temporarily unavailable",
  );
  await expect(page.locator(".new-key")).not.toHaveText("");
  const releaseRevoke = await hold(
    page,
    `**/api/products/${product.id}/keys/*`,
    (r) => r.method() === "DELETE",
  );
  try {
    await page.getByRole("button", { name: "Revoke key", exact: true }).click();
    await expect(page.getByRole("button", { name: "Revoking…", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
  } finally {
    releaseRevoke();
  }
  await expect(page.getByRole("alertdialog")).not.toBeVisible();
  await expect(page.getByText("Ingestion key revoked.", { exact: true })).toBeVisible();
  await expect(page.locator(".new-key")).not.toBeVisible();
});

test("server HTML includes a loading placeholder before JavaScript runs", async ({ request }) => {
  const response = await request.get("/");
  expect(response.ok()).toBe(true);
  const html = await response.text();
  expect(html).toContain('aria-label="Loading page"');
  expect(html).toContain('data-slot="skeleton"');
  expect(html).not.toContain("Opening Piko…");
});

test("product creation stays pending and retries catalog reload without duplicating the product", async ({
  page,
}) => {
  let createdPosts = 0;
  let failCatalog = true;
  let releasePost = () => {};
  const gate = new Promise<void>((resolve) => {
    releasePost = resolve;
  });
  await page.route("**/api/products", async (route) => {
    if (route.request().method() === "POST") {
      createdPosts++;
      await gate;
      await route.continue();
    } else if (createdPosts && failCatalog) {
      failCatalog = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Catalog temporarily unavailable" }),
      });
    } else await route.continue();
  });
  await page.goto("/settings");
  await expect(page.getByText("Loading fixture", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New product", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create a product", exact: true });
  const name = `Loading create ${Date.now()}`;
  await dialog.getByLabel("Product name").fill(name);
  try {
    await dialog.getByRole("button", { name: "Create product", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Creating…", exact: true })).toBeDisabled();
    await expect(dialog.getByLabel("Product name")).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeVisible();
  } finally {
    releasePost();
  }
  await expect(dialog.getByRole("alert")).toContainText(
    "Product created. Could not refresh the workspace.",
  );
  await expect(dialog.getByLabel("Product name")).toBeDisabled();
  await dialog.getByRole("button", { name: "Retry loading product", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("combobox", { name: "Select product" })).toContainText(name);
  expect(createdPosts).toBe(1);
});
