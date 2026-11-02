import { expect, test } from "@playwright/test";
const api = process.env.PIKO_API_URL;
if (!api) throw new Error("Use the isolated E2E runner");

test("live identity widget, in-place filters, and independent external row links", async ({
  page,
  context,
}) => {
  async function post(path: string, body: unknown) {
    const response = await fetch(`${api}/api${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-piko-admin": "1" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  }
  const project = await post("/products", {
    name: `Plausible flow ${Date.now()}`,
    retention_days: 365,
  });
  const { key } = await post(`/products/${project.id}/keys`, { label: "Flow test" });
  const events = [
    { actor_id: "shared", identity_kind: "visitor", path: "/docs", age: 1000 },
    { actor_id: "shared", identity_kind: "visitor", path: "/docs", age: 2000 },
    { actor_id: "shared", identity_kind: "installation", path: "/cli", age: 1000 },
    { path: "/docs", age: 1000 },
    { actor_id: "expired", identity_kind: "visitor", path: "/docs", age: 7 * 60000 },
  ].map(({ path, age, ...identity }) => ({
    event_id: crypto.randomUUID(),
    name: "page_view",
    source: "sdk",
    timestamp: new Date(Date.now() - age).toISOString(),
    properties: { path },
    ...identity,
  }));
  const ingested = await fetch(`${api}/api/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ events }),
  });
  expect(ingested.ok).toBe(true);
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  await page.route("**/api/products", async (route) => {
    const response = await route.fetch();
    const products = await response.json();
    await route.fulfill({
      json: products.map((p: { id: string }) =>
        p.id === project.id ? { ...p, website_url: "https://example.com" } : p,
      ),
    });
  });
  await page.goto(`/projects/${project.slug}?source=all&days=30`);
  await expect(page.locator(".live-metric .widget-value")).toHaveText("2");
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("5");
  await page.getByRole("combobox", { name: "Breakdown", exact: true }).click();
  await page.getByRole("option", { name: "Pages", exact: true }).click();
  const filter = page.getByRole("link", { name: "Filter by /docs", exact: true });
  const external = page.getByRole("link", { name: "Open /docs in a new tab", exact: true });
  await expect(external).toHaveAttribute("href", "https://example.com/docs");
  await expect(external).toHaveAttribute("target", "_blank");
  await expect(external).toHaveAttribute("rel", "noopener noreferrer");
  await expect(external).toHaveCSS("opacity", "0");
  await filter.hover();
  await expect(external).toHaveCSS("opacity", "1");
  await page.mouse.move(0, 0);
  await external.focus();
  await expect(external).toHaveCSS("opacity", "1");
  await context.route("https://example.com/docs", (route) =>
    route.fulfill({ body: "Example documentation" }),
  );
  const popup = page.waitForEvent("popup");
  await external.click();
  const opened = await popup;
  await expect(opened).toHaveURL("https://example.com/docs");
  await opened.close();
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("5");
  await filter.click();
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("4");
  await expect(page.locator(".live-metric .widget-value")).toHaveText("1");
  expect(new URL(page.url()).pathname).toBe(`/projects/${project.slug}`);
  await page.reload();
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("4");
  await page.getByRole("button", { name: "Remove filter", exact: true }).click();
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("5");
  await page.goto(
    `/projects/${project.slug}?from=2020-01-01T00%3A00%3A00.000Z&to=2020-01-02T00%3A00%3A00.000Z`,
  );
  await expect(page.locator(".activity-widget .widget-value")).toHaveText("0");
  await expect(page.locator(".live-metric .widget-value")).toHaveText("2");
});
