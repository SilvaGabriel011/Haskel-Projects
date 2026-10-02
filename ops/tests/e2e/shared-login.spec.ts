import { expect, test, type Page } from "@playwright/test";

/**
 * A shared login: info@ is used by Mia (admin) and Tom (employee). Signing in
 * proves the login; each then picks themselves with a PIN and gets their own
 * role, and what they do is recorded with both labels: owner and user.
 * Seeded PINs: Mia 2580, Tom 1470 (prisma/seed.ts).
 */
const INFO = "info@haskelproject.com.au";

async function signInShared(page: Page) {
  const password = process.env.E2E_INFO_PASSWORD ?? "";
  expect(password, "set E2E_INFO_PASSWORD").not.toBe("");
  await page.goto("/login");
  await page.selectOption("#demo-email", INFO);
  await page.fill("#demo-password", password);
  await page.click('button:has-text("Sign in with password")');
  // The picker, whatever the address bar says: after a password sign-in the
  // redirect happens inside the sign-in action and the bar can still read
  // /dashboard. The next page load goes through the guard (below).
  await expect(page.getByRole("heading", { name: "who is it?" })).toBeVisible();
}

async function pick(page: Page, name: string, pin: string) {
  await page.getByRole("radio", { name: new RegExp(name) }).click();
  await page.fill("#pin", pin);
  await page.getByRole("button", { name: "Continue" }).click();
}

test("each person on a shared login picks themselves with a PIN, and gets their own role", async ({ page }) => {
  await signInShared(page);

  // Nothing opens until they say who they are.
  await page.goto("/stock");
  await expect(page).toHaveURL(/\/who$/);

  await pick(page, "Tom Nguyen", "0000");
  await expect(page.getByRole("alert").filter({ hasText: "Wrong PIN" })).toContainText("4 more tries");

  await page.fill("#pin", "1470");
  await page.getByRole("button", { name: "Continue" }).click();
  const sidebar = page.locator("aside");
  await expect(sidebar).toContainText("Tom Nguyen");
  await expect(sidebar).toContainText(`on ${INFO}`);
  // Tom is an employee: no Settings, whatever Mia can do on the same login.
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/dashboard\?denied=/);

  // Hand over to Mia without signing out of the login.
  await page.getByRole("button", { name: "Switch person" }).first().click();
  await expect(page.getByRole("heading", { name: "who is it?" })).toBeVisible();
  await pick(page, "Mia Torres", "2580");
  await expect(sidebar).toContainText("Mia Torres");

  // Mia is an admin, and Settings shows who did what, with both labels.
  await page.goto("/settings#activity");
  const activity = page.locator("#activity");
  const tomRow = activity.locator("div", { hasText: "user Tom Nguyen" }).filter({ hasText: `owner ${INFO}` });
  await expect(tomRow.first()).toBeVisible();
  const miaRow = activity.locator("div", { hasText: "user Mia Torres" }).filter({ hasText: `owner ${INFO}` });
  await expect(miaRow.first()).toBeVisible();
});

test("the login page lists a shared login once", async ({ page }) => {
  await page.goto("/login");
  await expect(page.locator(`#demo-email option[value="${INFO}"]`)).toHaveCount(1);
  await expect(page.locator(`#demo-email option[value="${INFO}"]`)).toContainText("shared: Mia, Tom");
});
