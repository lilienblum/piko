import { expect, test } from "@playwright/test";

const api = process.env.PIKO_API_URL;
let alpha: { id: string; name: string };
let zulu: { id: string; name: string };

test.beforeAll(async () => {
  const create = async (name: string) => {
    const response = await fetch(`${api}/api/products`, {
      method: "POST",
      headers: { "x-piko-admin": "1", "content-type": "application/json" },
      body: JSON.stringify({ name, retention_days: 30 }),
    });
    expect(response.ok).toBe(true);
    return response.json();
  };
  alpha = await create(`Alpha keyboard ${Date.now()}`);
  zulu = await create(`Zulu keyboard ${Date.now()}`);
});

test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => localStorage.setItem("piko:product", id), alpha.id);
});

test("project select supports typeahead, keyboard selection, Escape and human-readable labels", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const overview = page.getByRole("link", { name: "Overview", exact: true });
  await expect(overview).toHaveAttribute("aria-current", "page");
  await expect(overview).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const select = page.getByRole("combobox", { name: "Select project", exact: true });
  await expect(select).toContainText(alpha.name);
  await select.press("ArrowDown");
  await page.keyboard.type("Zulu");
  await expect(page.getByRole("option", { name: zulu.name, exact: true })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(select).toContainText(zulu.name);
  await expect(select).toBeFocused();
  await expect(page.getByRole("heading", { name: zulu.name, exact: true })).toBeVisible();
  await select.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(select).toBeFocused();
  await expect(select).toContainText(zulu.name);
  expect(await context.cookies()).toEqual([]);
  await expect(page.getByRole("link", { name: "Explore events", exact: true })).toHaveAttribute(
    "href",
    "/explore",
  );
});

test("nested source select closes before its dialog and restores keyboard focus", async ({
  page,
}) => {
  await page.goto("/settings");
  const opener = page.getByRole("button", { name: "Add source", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Source name").fill("iOS client");
  const icon = dialog.getByRole("combobox", { name: "Icon", exact: true });
  await expect(icon).toContainText("Automatic · iOS");
  await icon.press("ArrowDown");
  await page.keyboard.type("Website");
  await page.keyboard.press("Enter");
  await expect(icon).toContainText("Website");
  await icon.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await expect(icon).toBeFocused();
  await dialog.getByRole("button", { name: "Close", exact: true }).focus();
  await page.keyboard.press("Tab");
  await expect(dialog.getByLabel("Source name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(opener).toBeFocused();
  const appearance = page.getByRole("button", { name: "Appearance", exact: true });
  for (let i = 0; i < 2; i++) {
    await appearance.click();
    await page.getByRole("menuitemradio", { name: "Dark", exact: true }).click();
    await expect(page.getByRole("menu")).not.toBeVisible();
    await expect(appearance).toBeFocused();
  }
});

for (const width of [1440, 894, 390]) {
  test(`selects keep the page scrollbar and layout stable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/settings");
    await expect(page.getByLabel("Project name", { exact: true })).toHaveValue(alpha.name);
    const geometry = () =>
      page.evaluate(() => {
        const main = document.querySelector("main")?.getBoundingClientRect();
        if (!main) throw new Error("Expected the dashboard layout to be mounted");
        return {
          gutter: innerWidth - document.documentElement.clientWidth,
          bodyWidth: document.body.getBoundingClientRect().width,
          mainX: main.x,
          mainWidth: main.width,
          scrollY,
        };
      });
    const before = await geometry();
    for (const name of ["Select project", "Event timezone"]) {
      const select = page.getByRole("combobox", { name, exact: true });
      await select.click();
      await expect(page.getByRole("listbox")).toBeVisible();
      expect(await geometry()).toEqual(before);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("listbox")).toBeHidden();
      await expect(select).toBeFocused();
      expect(await geometry()).toEqual(before);
    }
    // A filter picker must not lock page scrolling or remove its scrollbar.
    await page.getByRole("combobox", { name: "Select project", exact: true }).click();
    await page.mouse.move(width / 2, 700);
    await page.mouse.wheel(0, 200);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before.scrollY);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
  });
}
