import { expect, test } from "@playwright/test";

/**
 * A new starter's first sign-in.
 *
 * The seed leaves the apprentice as someone who has never finished the
 * walkthrough, so this needs a freshly seeded database — as CI has. Finishing
 * it is recorded, so a second local run needs `npm run db:seed` first.
 */
const NEW_STARTER = {
  email: "apprentice@haskelproject.com.au",
  password: process.env.E2E_APPRENTICE_PASSWORD ?? "",
};

test("a new starter is shown round once, then goes straight to work", async ({ page }) => {
  expect(NEW_STARTER.password, "set E2E_APPRENTICE_PASSWORD").not.toBe("");
  await page.goto("/login");
  await page.selectOption("#demo-email", NEW_STARTER.email);
  await page.fill("#demo-password", NEW_STARTER.password);
  await page.click('button:has-text("Sign in with password")');

  // Signing in lands on the dashboard, which sends a newcomer to /welcome.
  await page.waitForURL("**/welcome");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/welcome/i);
  // An employee is told which moves are the office's, and shown no money.
  await expect(page.getByText("Office").first()).toBeVisible();
  expect(await page.evaluate(() => /\$[\d,]+/.test(document.body.innerText))).toBe(false);

  await page.getByRole("button", { name: /i.m ready/i }).click();
  await page.waitForURL("**/dashboard");

  // Done once, done for good: the dashboard no longer sends them away.
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/dashboard$/);

  // And it is still there to come back to.
  await page.getByRole("link", { name: "Getting started" }).click();
  await page.waitForURL("**/welcome");
});
