// The client mount's two-region Lesson screen (05 5.10), on the dev server's
// harness page (test/mount-page): every slot set, a practice pane beside the
// Lesson column on desktop and under the Lesson strip on a phone.
import { expect, test, type Locator, type Page } from "@playwright/test";
import { DEV } from "../playwright.config.ts";

test.use({ baseURL: DEV });

async function open(page: Page) {
  await page.goto("/test/mount-page/index.html#/lesson/b-1/step");
  await expect(page.locator("[data-practice-pane]")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.locator("[data-step-card]")).toBeVisible();
  // The screen rises into place as it opens; boxes are measured where it lands.
  await page
    .locator("[data-screen]")
    .evaluate((el) =>
      Promise.all(el.getAnimations().map((a) => a.finished.catch(() => null))),
    );
}

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (found === null) throw new Error(`No box for ${String(locator)}`);
  return found;
}

const column = (page: Page) => page.locator("[data-lesson-column]");
const pane = (page: Page) => page.locator("[data-practice-pane]");
const bar = (page: Page) => page.locator("[data-action-bar]");
const gutter = (page: Page) =>
  page.evaluate(() =>
    parseFloat(
      getComputedStyle(
        document.querySelector("[data-practice-pane]") as Element,
      ).paddingLeft,
    ),
  );

test.describe("at 1440 px", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("at 1440 the column is 720 px and the pane fills the rest, sticky", async ({
    page,
  }) => {
    await open(page);
    const col = await box(column(page));
    const pan = await box(pane(page));
    expect(col.x).toBe(0);
    expect(col.width).toBe(720);
    expect(pan.x).toBeCloseTo(720, 0);
    expect(pan.x + pan.width).toBeCloseTo(1440, 0);
    const top = await box(page.locator("[data-top]"));
    expect(pan.y).toBeCloseTo(top.y + top.height, 0);
    expect(pan.height).toBeCloseTo(900 - top.height, 0);

    // A window shorter than the Lesson scrolls; the pane stays in view under the top.
    await page.setViewportSize({ width: 1440, height: 500 });
    const scrolled = await page.evaluate(() => {
      window.scrollTo(0, 300);
      return window.scrollY;
    });
    expect(scrolled).toBeGreaterThan(0);
    const after = await box(pane(page));
    expect(after.y).toBeCloseTo(top.height, 0);
    expect(after.height).toBeCloseTo(500 - top.height, 0);
  });

  test("the action bar's right edge meets the pane's gutter", async ({
    page,
  }) => {
    await open(page);
    const actions = await box(bar(page));
    const col = await box(column(page));
    const pan = await box(pane(page));
    expect(actions.x).toBeCloseTo(col.x, 0);
    expect(actions.x + actions.width).toBeCloseTo(pan.x, 0);
    expect(await gutter(page)).toBe(16);
    // In the column's flow, never fixed to the window.
    expect(
      await bar(page).evaluate((el) => getComputedStyle(el).position),
    ).toBe("sticky");
    expect(actions.y + actions.height).toBeLessThanOrEqual(900);
  });
});

test.describe("at 1100 px", () => {
  test.use({ viewport: { width: 1100, height: 800 } });

  test("at 1100 the column follows clamp(420px, 45vw, 720px)", async ({
    page,
  }) => {
    await open(page);
    const col = await box(column(page));
    expect(col.width).toBeCloseTo(1100 * 0.45, 0);
    const pan = await box(pane(page));
    expect(pan.x).toBeCloseTo(col.width, 0);
  });
});

test.describe("at 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("at 390 the page does not scroll, the terminal has at least 55dvh, the action bar is pinned at the strip's bottom, and More expands the strip to 70dvh", async ({
    page,
  }) => {
    await open(page);
    const scrolls = () =>
      page.evaluate(() => ({
        down:
          document.documentElement.scrollHeight >
          document.documentElement.clientHeight,
        sideways:
          document.documentElement.scrollWidth >
          document.documentElement.clientWidth,
      }));
    // Settles once the shell has measured the top's height (--top-height).
    await expect.poll(scrolls).toEqual({ down: false, sideways: false });

    const strip = page.locator("[data-lesson-strip]");
    // The strip scrolls inside itself.
    expect(
      await strip.evaluate((el) => el.scrollHeight > el.clientHeight),
    ).toBe(true);
    const pan = await box(pane(page));
    expect(pan.height).toBeGreaterThanOrEqual(844 * 0.55 - 0.5);
    expect(pan.y + pan.height).toBeCloseTo(844, 0);
    const actions = await box(bar(page));
    expect(actions.y + actions.height).toBeCloseTo(pan.y, 0);
    const before = await box(strip);
    expect(before.y + before.height).toBeLessThanOrEqual(actions.y);

    const more = page.locator("[data-strip-more]");
    await expect(more).toHaveText("More");
    await more.click();
    await expect(more).toHaveText("Less");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    const grown = await box(strip);
    expect(grown.height).toBeGreaterThan(before.height);
    expect(grown.height).toBeCloseTo(844 * 0.7, 0);
    expect(await scrolls()).toEqual({ down: false, sideways: false });
    const pinned = await box(bar(page));
    expect(pinned.y).toBeGreaterThanOrEqual(grown.y + grown.height - 0.5);

    // Reading the terminal keeps the strip open; sending input puts it back.
    const input = page.getByRole("textbox", { name: "Terminal input" });
    await input.focus();
    await expect(more).toHaveAttribute("aria-expanded", "true");
    await input.pressSequentially("ls");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    expect((await box(pane(page))).height).toBeGreaterThanOrEqual(
      844 * 0.55 - 0.5,
    );
  });
});
