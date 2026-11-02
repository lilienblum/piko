import { expect, test, type Page } from "@playwright/test";
import type { Product } from "../apps/dashboard/src/lib/api";

const api = process.env.PIKO_API_URL;
if (!api) throw new Error("Use the isolated E2E runner");
const day = 86400000;
const today = new Date().toISOString().slice(0, 10);
const midnight = Date.parse(`${today}T00:00:00Z`);
const start = new Date(midnight - 6 * day).toISOString().slice(0, 10);
const end = new Date(midnight - 4 * day).toISOString().slice(0, 10);
const from = `${start}T00:00:00.000Z`;
const to = new Date(midnight - 3 * day).toISOString();
let project: Product;
async function post(path: string, body: unknown) {
  const response = await fetch(`${api}/api${path}`, {
    method: "POST",
    headers: { "x-piko-admin": "1", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.ok).toBe(true);
  return response.json();
}
async function open(page: Page) {
  await page.route("**/_piko/runtime", (route) => route.fulfill({ json: { live: false } }));
  await page.goto(`/projects/${project.slug}?source=all&days=30`);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("4");
}
const dateMenu = (page: Page) => page.getByRole("menu", { name: "Date range", exact: true });
const picker = (page: Page) => page.getByRole("dialog", { name: "Date range", exact: true });
const trigger = (page: Page) =>
  page.getByRole("button", { name: "Choose date range", exact: true });

test.beforeAll(async () => {
  project = await post("/products", { name: `Calendar ${Date.now()}`, retention_days: 365 });
  const { key } = await post(`/products/${project.id}/keys`, { label: "Calendar fixture" });
  const response = await fetch(`${api}/api/ingest`, {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      events: [Date.parse(from) - 1, Date.parse(from), Date.parse(to) - 1, Date.parse(to)].map(
        (timestamp, i) => ({
          event_id: crypto.randomUUID(),
          name: "checkout",
          source: "sdk",
          timestamp: new Date(timestamp).toISOString(),
          properties: { amount: (i + 1) * 10 },
        }),
      ),
    }),
  });
  expect(response.ok).toBe(true);
});

test("calendar applies inclusive UTC dates, preserves scope, and shares across timezones", async ({
  page,
  browser,
}) => {
  await open(page);
  const original = page.url();
  await trigger(page).click();
  await dateMenu(page).getByRole("menuitemradio", { name: "Custom range", exact: true }).click();
  await expect(picker(page).getByRole("grid")).toHaveCount(2);
  await picker(page).locator(`button[data-day="${start}"]`).click();
  await expect(
    picker(page).getByRole("button", { name: "Apply range", exact: true }),
  ).toBeDisabled();
  await picker(page).locator(`button[data-day="${end}"]`).click();
  await expect(picker(page).getByLabel("Start date", { exact: true })).toHaveValue(start);
  await expect(picker(page).getByLabel("End date", { exact: true })).toHaveValue(end);
  expect(page.url()).toBe(original);
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith(`/products/${project.id}/query`) &&
      r.postDataJSON().from === from &&
      r.postDataJSON().to === to,
  );
  await picker(page).getByRole("button", { name: "Apply range", exact: true }).click();
  await request;
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
  await expect(trigger(page)).toHaveAttribute("data-fixed", "true");
  const link = page.url();
  expect(new URL(link).searchParams.get("from")).toBe(from);
  expect(new URL(link).searchParams.get("to")).toBe(to);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByText("across 2 matching events")).toBeVisible();
  expect(new URL(page.url()).searchParams.get("from")).toBe(from);
  await page.goBack();
  const recipient = await browser.newContext({
    ignoreHTTPSErrors: true,
    timezoneId: "America/Los_Angeles",
  });
  try {
    const shared = await recipient.newPage();
    await shared.goto(link);
    await expect(shared.locator(".activity-widget .widget-value").first()).toHaveText("2");
    await trigger(shared).click();
    await dateMenu(shared)
      .getByRole("menuitemradio", { name: "Custom range", exact: true })
      .click();
    await expect(picker(shared).getByLabel("Start date", { exact: true })).toHaveValue(start);
    await expect(picker(shared).getByLabel("End date", { exact: true })).toHaveValue(end);
    await expect(picker(shared).locator(`button[data-day="${start}"]`)).toHaveAttribute(
      "data-range-start",
      "true",
    );
  } finally {
    await recipient.close();
  }
  await trigger(page).click();
  await page.getByRole("menuitemradio", { name: "Last 7 days", exact: true }).click();
  await expect(trigger(page)).toContainText("Last 7 days");
  expect(new URL(page.url()).searchParams.has("from")).toBe(false);
  expect(new URL(page.url()).searchParams.has("to")).toBe(false);
  await page.goBack();
  await expect(trigger(page)).toHaveAttribute("data-fixed", "true");
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("2");
});

for (const width of [1440, 390]) {
  test(`date drafts cancel, reject invalid input, and keep layout stable at ${width}px`, async ({
    page,
  }) => {
    const height = width < 768 ? 844 : 720;
    await page.setViewportSize({ width, height });
    await open(page);
    const url = page.url();
    const before = await page.locator("#main-content").boundingBox();
    await trigger(page).click();
    await dateMenu(page).getByRole("menuitemradio", { name: "Custom range", exact: true }).click();
    await expect(picker(page).getByRole("grid")).toHaveCount(width < 768 ? 1 : 2);
    expect(await page.locator("#main-content").boundingBox()).toEqual(before);
    const box = await picker(page).boundingBox();
    expect(box?.x).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await expect(picker(page)).toHaveAttribute("data-side", "bottom");
    const button = await trigger(page).boundingBox();
    expect(box?.y).toBeGreaterThanOrEqual((button?.y ?? 0) + (button?.height ?? 0));
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(height);
    await picker(page).getByLabel("Start date", { exact: true }).fill(end);
    await picker(page).getByLabel("End date", { exact: true }).fill(start);
    await expect(picker(page).locator("#range-feedback")).toContainText("on or after");
    await expect(picker(page).getByRole("button", { name: "Apply range" })).toBeDisabled();
    await picker(page).getByLabel("Start date", { exact: true }).fill("2026-02-30");
    await expect(picker(page).locator("#range-feedback")).toContainText("valid dates");
    await page.keyboard.press("Escape");
    await expect(picker(page)).toBeHidden();
    await expect(trigger(page)).toBeFocused();
    expect(page.url()).toBe(url);
    await trigger(page).click();
    await dateMenu(page).getByRole("menuitemradio", { name: "Custom range", exact: true }).click();
    await expect(picker(page).getByLabel("Start date", { exact: true })).not.toHaveValue(
      "2026-02-30",
    );
    await picker(page).getByLabel("Start date", { exact: true }).fill(start);
    await picker(page).getByLabel("End date", { exact: true }).fill(start);
    await expect(picker(page).locator("#range-feedback")).toHaveText("1 day selected");
    await picker(page).getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(picker(page)).toBeHidden();
    expect(page.url()).toBe(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test("legacy snapshot links display a calendar range without a pin button", async ({ page }) => {
  await page.goto(
    `/projects/${project.slug}?days=30&snapshot=${encodeURIComponent(new Date().toISOString())}`,
  );
  await expect(trigger(page)).toHaveAttribute("data-fixed", "true");
  await expect(page.getByRole("button", { name: "Pin dates" })).toHaveCount(0);
  await expect(page.locator(".activity-widget .widget-value").first()).toHaveText("4");
});

test("changing calendar dates preserves a drilldown's event and typed filter", async ({ page }) => {
  const selection = {
    from,
    to,
    sourceId: project.sources[0].id,
    event: "checkout",
    filter: { property: "amount", value: 20 },
  };
  await page.goto(
    `/projects/${project.slug}/explore?drilldown=${encodeURIComponent(JSON.stringify(selection))}`,
  );
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await trigger(page).click();
  await dateMenu(page).getByRole("menuitemradio", { name: "Custom range", exact: true }).click();
  const widerStart = new Date(Date.parse(from) - day).toISOString().slice(0, 10);
  await picker(page).getByLabel("Start date", { exact: true }).fill(widerStart);
  await picker(page).getByLabel("End date", { exact: true }).fill(today);
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith(`/products/${project.id}/query`) &&
      r.postDataJSON().from === `${widerStart}T00:00:00.000Z`,
  );
  await picker(page).getByRole("button", { name: "Apply range", exact: true }).click();
  expect((await request).postDataJSON()).toMatchObject({
    event: "checkout",
    filters: [{ property: "amount", op: "eq", value: 20 }],
  });
  await expect(page.getByText("across 1 matching events")).toBeVisible();
  await expect(page.getByLabel("Typed value")).toHaveValue("20");
});

test("calendar supports keyboard focus, range selection, and dismissal", async ({ page }) => {
  await open(page);
  const url = page.url();
  await trigger(page).click();
  await dateMenu(page).getByRole("menuitemradio", { name: "Custom range", exact: true }).click();
  await expect(picker(page).locator('button[data-range-start="true"]')).toBeFocused();
  const first = picker(page).locator(`button[data-day="${start}"]`);
  await first.focus();
  await first.press("Enter");
  await expect(picker(page).getByLabel("End date", { exact: true })).toHaveValue("");
  await first.press("ArrowRight");
  const nextDay = new Date(Date.parse(from) + day).toISOString().slice(0, 10);
  const next = picker(page).locator(`button[data-day="${nextDay}"]`);
  await expect(next).toBeFocused();
  await next.press("ArrowRight");
  const last = picker(page).locator(`button[data-day="${end}"]`);
  await expect(last).toBeFocused();
  await last.press("Enter");
  await expect(picker(page).getByLabel("Start date", { exact: true })).toHaveValue(start);
  await expect(picker(page).getByLabel("End date", { exact: true })).toHaveValue(end);
  await expect(picker(page).locator("#range-feedback")).toHaveText("3 days selected");
  await page.keyboard.press("Escape");
  await expect(picker(page)).toBeHidden();
  await expect(trigger(page)).toBeFocused();
  expect(page.url()).toBe(url);
});

test("one period picker navigates days and calendar months without future dates", async ({
  page,
}) => {
  await open(page);
  await trigger(page).click();
  await dateMenu(page).getByRole("menuitemradio", { name: "Today", exact: true }).click();
  await expect(trigger(page)).toContainText("Today");
  await expect(page.getByRole("button", { name: "Next period", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Previous period", exact: true }).click();
  const yesterday = new Date(midnight - day).toISOString();
  await expect.poll(() => new URL(page.url()).searchParams.get("from")).toBe(yesterday);
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(trigger(page)).toContainText("Today");
  await trigger(page).click();
  await dateMenu(page).getByRole("menuitemradio", { name: "Month to date", exact: true }).click();
  await page.getByRole("button", { name: "Previous period", exact: true }).click();
  const first = new Date(`${today.slice(0, 7)}-01T00:00:00.000Z`);
  const previous = new Date(first);
  previous.setUTCMonth(previous.getUTCMonth() - 1);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("from"))
    .toBe(previous.toISOString());
  expect(new URL(page.url()).searchParams.get("to")).toBe(first.toISOString());
  await page.reload();
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(trigger(page)).toContainText("Month to date");
  await expect(page.getByRole("button", { name: "Next period", exact: true })).toBeDisabled();
  await expect(page.getByRole("group", { name: "Chart interval" })).toHaveCount(0);
});

for (const size of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
  { width: 320, height: 568 },
  { width: 390, height: 420 },
]) {
  test(`date menu lays out every preset vertically and arrows flank the date at ${size.width}x${size.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(size);
    await open(page);
    const before = await trigger(page).boundingBox();
    await trigger(page).click();
    const menu = dateMenu(page);
    await expect(menu).toHaveCSS("opacity", "1");
    const options = menu;
    await expect(menu.getByRole("separator")).toHaveCount(4);
    const rows = await options.getByRole("menuitemradio").evaluateAll((elements) =>
      elements.map((el) => {
        const rect = el.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    expect(rows).toHaveLength(11);
    for (let index = 1; index < rows.length; index++) {
      expect(rows[index].y).toBeGreaterThanOrEqual(rows[index - 1].y + rows[index - 1].height - 1);
      expect(Math.abs(rows[index].x - rows[0].x)).toBeLessThan(1);
    }
    expect(await menu.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const box = await menu.boundingBox();
    expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(size.height);
    const last = options.getByRole("menuitemradio", { name: "Last 12 months", exact: true });
    if (size.height >= 800) {
      await expect(last).toBeInViewport();
      await expect(
        menu.getByRole("menuitemradio", { name: "Custom range", exact: true }),
      ).toBeInViewport();
    } else {
      await last.focus();
      await expect(last).toBeInViewport();
      const custom = menu.getByRole("menuitemradio", { name: "Custom range", exact: true });
      await custom.focus();
      await expect(custom).toBeInViewport();
      expect(await menu.evaluate((el) => el.scrollLeft)).toBe(0);
    }
    await options.getByRole("menuitemradio", { name: "Today", exact: true }).click();
    const prev = page.getByRole("button", { name: "Previous period", exact: true });
    const next = page.getByRole("button", { name: "Next period", exact: true });
    const previousBox = await prev.boundingBox();
    const dateBox = await trigger(page).boundingBox();
    const nextBox = await next.boundingBox();
    expect((previousBox?.x ?? 0) + (previousBox?.width ?? 0)).toBeLessThanOrEqual(dateBox?.x ?? 0);
    expect(nextBox?.x).toBeGreaterThanOrEqual((dateBox?.x ?? 0) + (dateBox?.width ?? 0));
    await expect(next).toBeDisabled();
    await page.goto(
      `/projects/${project.slug}?from=2025-12-15T00%3A00%3A00.000Z&to=2026-01-20T00%3A00%3A00.000Z`,
    );
    await expect(trigger(page)).toContainText("2025");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await trigger(page).click();
    await expect(options.getByRole("menuitemradio")).toHaveCount(11);
    await expect(menu).toHaveCSS("opacity", "1");
    await expect(page.locator(".page-content")).toHaveAttribute("aria-busy", "false");
    await page.screenshot({ path: `/tmp/piko-date-menu-${size.width}x${size.height}.png` });
    await page.keyboard.press("Escape");
    await expect(trigger(page)).toBeFocused();
    expect((await trigger(page).boundingBox())?.y).toBe(before?.y);
  });
}

test("visible preset shortcuts select periods and bracket keys navigate without future dates", async ({
  page,
}) => {
  await open(page);
  const request = page.waitForRequest(
    (r) =>
      r.url().endsWith(`/products/${project.id}/query`) &&
      Date.parse(r.postDataJSON().to) - Date.parse(r.postDataJSON().from) === day,
  );
  await trigger(page).press("h");
  await request;
  await expect(trigger(page)).toContainText("Last 24 hours");
  await expect(page.getByText(/One point per hour/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous period", exact: true })).toHaveCount(0);
  for (const [key, value, label] of [
    ["d", "today", "Today"],
    ["e", "yesterday", "Yesterday"],
    ["w", "7", "Last 7 days"],
    ["f", "30", "Last 30 days"],
    ["n", "90", "Last 90 days"],
    ["m", "month", "Month to date"],
    ["p", "last-month", "Last month"],
    ["y", "year", "Year to date"],
    ["l", "12months", "Last 12 months"],
  ]) {
    await trigger(page).press(key);
    await expect(trigger(page)).toContainText(label);
    const params = new URL(page.url()).searchParams;
    expect(params.get(/^\d+$/.test(value) ? "days" : "period")).toBe(value);
    expect(params.get("source")).toBe("all");
    await trigger(page).click();
    const item = dateMenu(page).getByRole("menuitemradio", { name: label, exact: true });
    await expect(item).toHaveAttribute("aria-checked", "true");
    await expect(item).toHaveAttribute("aria-keyshortcuts", key.toUpperCase());
    await expect(item.locator("kbd")).toHaveText(key.toUpperCase());
    await page.keyboard.press("Escape");
    await expect(trigger(page)).toBeFocused();
  }
  // Shortcuts also work inside the menu, before Base UI's typeahead.
  await trigger(page).click();
  await dateMenu(page).press("d");
  await expect(trigger(page)).toContainText("Today");
  await expect(dateMenu(page)).toBeHidden();
  await trigger(page).press("[");
  await expect
    .poll(() => new URL(page.url()).searchParams.get("from"))
    .toBe(new Date(midnight - day).toISOString());
  await trigger(page).press("]");
  await expect(trigger(page)).toContainText("Today");
  const url = page.url();
  await trigger(page).press("]");
  expect(page.url()).toBe(url);
});

test("custom shortcut and preset back action hand off focus without scrolling", async ({
  page,
}) => {
  await open(page);
  const before = await trigger(page).boundingBox();
  await trigger(page).click();
  await dateMenu(page).press("c");
  await expect(picker(page)).toBeVisible();
  await expect(picker(page).locator('button[data-range-start="true"]')).toBeFocused();
  expect(await trigger(page).boundingBox()).toEqual(before);
  await picker(page).getByRole("button", { name: "Preset periods" }).click();
  await expect(dateMenu(page)).toBeVisible();
  await expect(picker(page)).toBeHidden();
  await dateMenu(page).press("Escape");
  await expect(trigger(page)).toBeFocused();
  await trigger(page).press("c");
  await expect(picker(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  expect(await trigger(page).boundingBox()).toEqual(before);
});

test("shortcuts leave typing, other overlays, and modified key presses alone", async ({ page }) => {
  await open(page);
  await page.getByRole("link", { name: "Explore", exact: true }).click();
  await expect(page.getByText("across 4 matching events")).toBeVisible();
  const original = page.url();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  const input = page.getByLabel("Property", { exact: true });
  await input.pressSequentially("new_day");
  await expect(input).toHaveValue("new_day");
  expect(page.url()).toBe(original);
  const projectSelect = page.getByRole("combobox", { name: "Select project", exact: true });
  await projectSelect.click();
  await page.keyboard.press("d");
  await expect(page.getByRole("listbox")).toBeVisible();
  expect(page.url()).toBe(original);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Inspect checkout", exact: true }).first().click();
  await page.getByRole("dialog").press("d");
  expect(page.url()).toBe(original);
  await page.keyboard.press("Escape");
  await trigger(page).press("Control+d");
  await trigger(page).press("Meta+d");
  await trigger(page).press("Alt+d");
  expect(page.url()).toBe(original);
  await trigger(page).press("w");
  await expect(trigger(page)).toContainText("Last 7 days");
  await expect(input).toHaveValue("new_day");
});

test("date shortcuts can be disabled persistently while ordinary menu navigation still works", async ({
  page,
}) => {
  await open(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const preference = page.getByRole("switch", { name: "Date keyboard shortcuts", exact: true });
  await expect(preference).toBeChecked();
  await preference.click();
  await expect(preference).not.toBeChecked();
  await page.reload();
  await expect(preference).not.toBeChecked();
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await trigger(page).press("d");
  await expect(trigger(page)).toContainText("Last 30 days");
  await trigger(page).click();
  await expect(dateMenu(page).locator("kbd")).toHaveCount(0);
  await expect(dateMenu(page).locator("[aria-keyshortcuts]")).toHaveCount(0);
  const yesterday = dateMenu(page).getByRole("menuitemradio", { name: "Yesterday", exact: true });
  await yesterday.focus();
  await yesterday.press("ArrowUp");
  const current = dateMenu(page).getByRole("menuitemradio", { name: "Today", exact: true });
  await expect(current).toBeFocused();
  await current.press("Enter");
  await expect(trigger(page)).toContainText("Today");
});

test("custom shortcut brings an off-screen date control into view", async ({ page }) => {
  await open(page);
  await page.getByRole("heading", { name: "Duration", exact: true }).scrollIntoViewIfNeeded();
  expect((await trigger(page).boundingBox())?.y).toBeLessThan(0);
  await page.keyboard.press("c");
  await expect(picker(page)).toBeVisible();
  await expect(trigger(page)).toBeInViewport();
  const box = await picker(page).boundingBox();
  expect(box?.y).toBeGreaterThanOrEqual(0);
  expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
});
