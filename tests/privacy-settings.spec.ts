import { expect, test } from "@playwright/test";

test("Settings defaults minimize collection without changing existing retention", async ({
  page,
}) => {
  const api = process.env.PIKO_API_URL ?? "http://127.0.0.1:3001";
  const response = await fetch(`${api}/api/products`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-piko-admin": "1" },
    body: JSON.stringify({
      name: `Privacy settings ${Date.now()}`,
      kind: "website",
      retention_days: 90,
    }),
  });
  expect(response.ok).toBe(true);
  const existing = await response.json();
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), existing.id);
  await page.goto("/settings");
  await expect(page.getByLabel("Retention (days)")).toHaveValue("90");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Create a project" });
  await expect(dialog.getByLabel("Retention (days)")).toHaveValue("30");
  await dialog.getByLabel("Project name").fill(`Privacy default ${Date.now()}`);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/products") && response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Create project", exact: true }).click();
  expect((await (await created).json()).retention_days).toBe(30);
  await expect(dialog).toHaveCount(0);
  await expect(page.getByLabel("Retention (days)")).toHaveValue("30");
  const snippet = page.locator(".integration-code");
  await expect(snippet).toContainText('referrerpolicy="no-referrer"');
  await expect(snippet).toContainText('identity: "none"');
  await expect(snippet).not.toContainText('identity: "persistent"');
  await expect(snippet).not.toContainText("campaigns:");
  await page
    .locator(".integration-card")
    .screenshot({ path: test.info().outputPath("privacy-settings.png") });
  await page.getByRole("tab", { name: "Rust CLI", exact: true }).click();
  await expect(snippet).toContainText("PIKO_TELEMETRY=1");
  await expect(snippet).toContainText("DO_NOT_TRACK=1");
  await expect(snippet).not.toContainText("PIKO_INSTALLATION_ID");
  await page.getByRole("combobox", { name: "Select project", exact: true }).click();
  await page.getByRole("option", { name: existing.name, exact: true }).click();
  await expect(page.getByLabel("Retention (days)")).toHaveValue("90");
});
