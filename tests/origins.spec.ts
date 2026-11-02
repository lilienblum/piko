import { expect, test } from "@playwright/test";

test("browser keys enforce editable origin restrictions through the dashboard proxy", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(`Origin rules ${Date.now()}`);
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const origin = new URL(page.url()).origin;
  await page.getByLabel("New key label").fill("Website browser");
  await page
    .getByLabel("Allowed origins", { exact: true })
    .fill(`${origin}, https://*.example.com`);
  await page.getByRole("button", { name: "Create ingestion key", exact: true }).click();
  const key = (await page.locator(".new-key").textContent())?.trim();
  expect(key).toMatch(/^pk_/);
  const send = () =>
    page.evaluate(async (key) => {
      const response = await fetch("/api/ingest", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({
          event_id: "browser-origin-retry",
          name: "page_view",
          source: "browser",
          properties: { path: "/" },
        }),
      });
      return { status: response.status, body: await response.json() };
    }, key);
  expect((await send()).body.accepted).toBe(1);
  await page.getByRole("button", { name: "Edit allowed origins for Website browser" }).click();
  await expect(dialog.getByLabel("Allowed origins", { exact: true })).toHaveValue(
    `${origin}, https://*.example.com`,
  );
  await dialog.getByLabel("Allowed origins", { exact: true }).fill("*");
  await dialog.getByRole("button", { name: "Save origins" }).click();
  await expect(dialog.getByText(/Use an HTTP/)).toBeVisible();
  await dialog.getByLabel("Allowed origins", { exact: true }).fill("https://example.com");
  await dialog.getByRole("button", { name: "Save origins" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await send()).status).toBe(403);
  await page.reload();
  await page.getByRole("button", { name: "Edit allowed origins for Website browser" }).click();
  await expect(dialog.getByLabel("Allowed origins", { exact: true })).toHaveValue(
    "https://example.com",
  );
  await dialog.getByLabel("Allowed origins", { exact: true }).fill("");
  await dialog.getByRole("button", { name: "Save origins" }).click();
  await expect(dialog).not.toBeVisible();
  expect((await send()).body.duplicates).toBe(1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Edit allowed origins for Website browser" }).click();
  await expect(dialog.getByRole("button", { name: "Save origins" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
