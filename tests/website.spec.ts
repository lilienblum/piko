import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const endpoint = process.env.PIKO_API_URL;
test("optional website persists, suggests the browser origin, and can be cleared", async ({
  page,
}) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Project name").fill(`Website settings ${Date.now()}`);
  await dialog.getByLabel("Website", { exact: true }).fill("http://127.0.0.1/private-path");
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("http://127.0.0.1");
  await expect(page.getByText(/No supported favicon found/)).toBeVisible();
  await page.getByRole("button", { name: "Use project website" }).click();
  await expect(page.getByLabel("Allowed origins", { exact: true })).toHaveValue("http://127.0.0.1");
  await page.reload();
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("http://127.0.0.1");
  await page.getByLabel("Website", { exact: true }).fill("");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Project changes saved.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Use project website" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByLabel("Website", { exact: true })).toHaveValue("");
});

test("project icons load only from Piko and failed images fall back without shifting the picker", async ({
  page,
}) => {
  const response = await fetch(`${endpoint}/api/products`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify({ name: `Cached icon ${Date.now()}`, retention_days: 30 }),
  });
  const project = await response.json();
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), project.id);
  // The real download/cache boundary is covered by Rust tests; UI fixtures avoid external network dependencies.
  await page.route("**/api/products", async (route) => {
    const response = await route.fetch();
    const products = await response.json();
    await route.fulfill({
      json: products.map((p: { id: string }) =>
        p.id === project.id
          ? { ...p, website_url: "https://example.com", favicon_version: "cached-test-icon" }
          : p,
      ),
    });
  });
  let fail = false;
  await page.route(`**/api/products/${project.id}/favicon?*`, async (route) => {
    if (fail) await route.fulfill({ status: 404, body: "" });
    else
      await route.fulfill({
        contentType: "image/png",
        body: await readFile(new URL("./fixtures/favicon.png", import.meta.url)),
      });
  });
  const remote: string[] = [];
  page.on("request", (request) => {
    if (
      request.resourceType() === "image" &&
      new URL(request.url()).origin !== new URL(page.url()).origin
    )
      remote.push(request.url());
  });
  await page.goto("/settings");
  const picker = page.getByRole("combobox", { name: "Select project", exact: true }).first();
  const image = picker.locator("img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1);
  const before = await picker.boundingBox();
  await picker.click();
  await expect(
    page.getByRole("option", { name: project.name, exact: true }).locator("img"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  fail = true;
  await page.reload();
  await expect(picker).toContainText(project.name);
  await expect(picker.locator("img")).toHaveCount(0);
  const after = await picker.boundingBox();
  expect(after?.width).toBe(before?.width);
  expect(after?.height).toBe(before?.height);
  expect(remote).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("combobox", { name: "Select project", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("website-settings-mobile.png"),
    fullPage: true,
  });
});
