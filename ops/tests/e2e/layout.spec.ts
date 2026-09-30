import { expect, test, type Page } from "@playwright/test";

/**
 * The page never scrolls sideways.
 *
 * Wide things — the boards, the stage timeline, the stock table — scroll
 * inside their own box. Three separate bugs broke that without any test
 * noticing: the app shell's grid column grew to fit a board (desktop), the
 * board cards' screen-reader labels escaped their scroll box (phone), and the
 * job page's lower grid grew to fit a long dropdown option (phone).
 */
const ADMIN = { email: "admin@haskelproject.com.au", password: process.env.E2E_ADMIN_PASSWORD ?? "" };

const ROUTES = ["/dashboard", "/stock", "/offcuts", "/orders", "/board", "/schedule", "/bookings", "/financials", "/settings"];

async function signIn(page: Page) {
  expect(ADMIN.password, "set E2E_ADMIN_PASSWORD").not.toBe("");
  await page.goto("/login");
  await page.selectOption("#demo-email", ADMIN.email);
  await page.fill("#demo-password", ADMIN.password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login")),
    page.click('button:has-text("Sign in with password")'),
  ]);
}

async function sidewaysScroll(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

for (const [name, viewport] of [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
] as const) {
  test.describe(`on a ${name}`, () => {
    test.use({ viewport });

    test("no page scrolls sideways", async ({ page }) => {
      await signIn(page);
      await page.goto("/orders");
      const job = await page.locator('a[href^="/orders/"]').first().getAttribute("href");
      for (const route of [...ROUTES, ...(job ? [job] : [])]) {
        await page.goto(route);
        expect(await sidewaysScroll(page), `${route} is wider than the window`).toBe(0);
      }
    });
  });
}

test.describe("the menu on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("is folded away, opens on a tap, and closes after following a link", async ({ page }) => {
    await signIn(page);
    const menu = page.locator('[aria-controls="app-menu"]');
    await expect(page.locator("#app-menu")).toBeHidden();
    await expect(menu).toHaveAttribute("aria-expanded", "false");

    await menu.click();
    await expect(page.locator("#app-menu")).toBeVisible();
    await expect(menu).toHaveAttribute("aria-expanded", "true");

    await page.locator('#app-menu a[href="/schedule"]').click();
    await page.waitForURL("**/schedule");
    await expect(page.locator("#app-menu")).toBeHidden();
  });
});
