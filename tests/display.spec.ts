import { expect, test } from "@playwright/test";

const api = process.env.PIKO_API_URL;
test("event timezone persists across reload, changes event inspection, and leaves raw timestamps intact", async ({
  page,
}) => {
  const admin = async (path: string, body: unknown) => {
    const response = await fetch(`${api}/api${path}`, {
      method: "POST",
      headers: { "x-piko-admin": "1", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    return response.json();
  };
  const project = await admin("/products", {
    name: `Display timezone ${Date.now()}`,
    retention_days: 30,
  });
  const { key } = await admin(`/products/${project.id}/keys`, { label: "Timezone fixture" });
  const timestamp = new Date();
  timestamp.setUTCDate(timestamp.getUTCDate() - 1);
  timestamp.setUTCHours(0, 30, 0, 0);
  const response = await fetch(`${api}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      event_id: crypto.randomUUID(),
      name: "timezone_test",
      source: "cli",
      timestamp: timestamp.toISOString(),
      properties: {},
    }),
  });
  expect(response.ok).toBe(true);
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), project.id);
  await page.goto("/settings");
  await expect(page.locator(".topbar, .live-status, .sidebar-footer, .page-footer")).toHaveCount(0);
  await expect(page.getByRole("menu", { name: "Date range", exact: true })).toHaveCount(0);
  const zone = page.getByRole("combobox", { name: "Event timezone", exact: true });
  await zone.click();
  await page.getByRole("option", { name: "Asia/Tokyo", exact: true }).click();
  await page.reload();
  await expect(zone).toContainText("Asia/Tokyo");
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(
    page.getByRole("columnheader", { name: "Time", exact: true }).locator("span"),
  ).toHaveAttribute("title", "Asia/Tokyo");
  await expect(page.locator(".stream-time")).toContainText("09:30:00");
  await expect(page.locator(".stream-time")).toHaveAttribute("datetime", timestamp.toISOString());
  await page.getByRole("button", { name: "Inspect timezone_test", exact: true }).click();
  const details = page.getByRole("dialog");
  await details.getByRole("tab", { name: "Metadata", exact: true }).click();
  await expect(details).toContainText("Event time (Asia/Tokyo)");
  await expect(details).toContainText("09:30:00");
  await details.getByRole("tab", { name: "JSON", exact: true }).click();
  await expect(details.locator("pre")).toContainText(String(timestamp.getTime()));
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
