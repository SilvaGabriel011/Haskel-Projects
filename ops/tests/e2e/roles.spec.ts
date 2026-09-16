import { expect, test, type Page } from "@playwright/test";

/**
 * The role matrix, asserted against a running app.
 *
 * Credentials come from the environment so nothing is hardcoded and no password
 * ever lands in the repository. Run with:
 *
 *   E2E_ADMIN_PASSWORD=... E2E_INSTALLER_PASSWORD=... npm run test:e2e
 */
const ADMIN = {
  email: "admin@haskelprojects.com.au",
  password: process.env.E2E_ADMIN_PASSWORD ?? "",
};
const INSTALLER = {
  email: "installer@haskelprojects.com.au",
  password: process.env.E2E_INSTALLER_PASSWORD ?? "",
};

const APP_ROUTES = ["/dashboard", "/stock", "/offcuts", "/orders", "/schedule", "/financials", "/settings"];
const ADMIN_ONLY = ["/financials", "/settings"];

async function signIn(page: Page, who: { email: string; password: string }) {
  expect(who.password, "set E2E_ADMIN_PASSWORD and E2E_INSTALLER_PASSWORD").not.toBe("");
  await page.goto("/login");
  await page.selectOption("#demo-email", who.email);
  await page.fill("#demo-password", who.password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.startsWith("/login")),
    page.click('button:has-text("Sign in with password")'),
  ]);
}

/** Does the visible page show a dollar amount anywhere? */
async function showsMoney(page: Page) {
  return page.evaluate(() => /\$[\d,]+/.test(document.body.innerText));
}

test.describe("signed out", () => {
  for (const route of APP_ROUTES) {
    test(`${route} sends you to the login page`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/);
    });
  }
});

test.describe("employee", () => {
  test.beforeEach(async ({ page }) => signIn(page, INSTALLER));

  for (const route of ADMIN_ONLY) {
    test(`${route} is refused, and says why`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard\?denied=/);
      // Filter rather than take the only alert: Next's dev overlay adds an
      // empty one, and a bare getByRole("alert") matches both.
      await expect(
        page.getByRole("alert").filter({ hasText: /admin only/i }),
      ).toBeVisible();
    });
  }

  test("the sidebar offers no admin-only section", async ({ page }) => {
    const links = await page.locator('nav[aria-label="Sections"] a').allTextContents();
    const joined = links.join(" ").toLowerCase();
    expect(joined).not.toContain("financial");
    expect(joined).not.toContain("settings");
  });

  test("sees no money on the stock list or a slab", async ({ page }) => {
    await page.goto("/stock");
    expect(await showsMoney(page), "stock list leaked a price").toBe(false);
    const slab = page.locator('tbody tr td a').first();
    await slab.click();
    await page.waitForURL(/\/stock\/.+/);
    expect(await showsMoney(page), "slab detail leaked a price").toBe(false);
  });

  test("sees no money on a job, but does get the cut list", async ({ page }) => {
    await page.goto("/orders?pipeline=SHORT");
    await page.locator('a[href^="/orders/"]').first().click();
    await page.waitForURL(/\/orders\/.+/);
    expect(await showsMoney(page), "job detail leaked a price").toBe(false);
    await expect(page.getByText(/cut list/i)).toBeVisible();
  });

  test("cannot widen the schedule by putting someone else in the URL", async ({ page }) => {
    await page.goto("/schedule?week=2026-09-14");
    const mine = await page.locator("body").innerText();
    const own = mine.match(/(\d+) booked/)?.[1];

    await page.goto("/schedule?week=2026-09-14&who=SOMEONE-ELSE");
    const widened = (await page.locator("body").innerText()).match(/(\d+) booked/)?.[1];

    expect(widened, "the server trusted a ?who= it should have ignored").toBe(own);
  });
});

test.describe("admin", () => {
  test.beforeEach(async ({ page }) => signIn(page, ADMIN));

  for (const route of APP_ROUTES) {
    test(`${route} opens`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(new RegExp(route.replace("/", "\\/")));
    });
  }

  test("does see money where an employee does not", async ({ page }) => {
    await page.goto("/stock");
    expect(await showsMoney(page), "admin stock list should show cost").toBe(true);
    await page.goto("/financials");
    expect(await showsMoney(page), "financials should show revenue").toBe(true);
  });
});
