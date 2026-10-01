import { expect, test } from "@playwright/test";

/**
 * Opening a job by hand, and adding stock with the stone dropdowns.
 *
 * Both create rows; they are named with a timestamp so a rerun on the same
 * database does not trip over the last run's.
 */
const ADMIN = { email: "admin@haskelproject.com.au", password: process.env.E2E_ADMIN_PASSWORD ?? "" };

test.beforeEach(async ({ page }) => {
  expect(ADMIN.password, "set E2E_ADMIN_PASSWORD").not.toBe("");
  await page.goto("/login");
  await page.selectOption("#demo-email", ADMIN.email);
  await page.fill("#demo-password", ADMIN.password);
  await page.click('button:has-text("Sign in with password")');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
});

test("a company's job opens with the homeowner and the stone attached", async ({ page }) => {
  const stamp = Date.now().toString().slice(-7);
  await page.goto("/orders");
  await page.getByRole("link", { name: "New job" }).click();
  await page.waitForURL("**/orders/new");

  await page.getByRole("radio", { name: "Create a client profile" }).click();
  await page.getByRole("radio", { name: "A company" }).click();
  await page.fill("#clientName", `Test Kitchens ${stamp}`);
  await page.fill("#contactName", "Dana");
  await page.fill("#phone", `0400 ${stamp}`);

  await page.fill("#address", "12 Example St");
  await page.selectOption("#suburb", "Prospect");
  await page.fill("#siteContactName", "Pat Homeowner");

  await page.selectOption("#jobType", "VANITY_TOP");

  // Colour waits for the type; thickness and finish fill in from the colour.
  await expect(page.locator("#materialId")).toBeDisabled();
  await page.selectOption("#stoneType", "ENGINEERED");
  const colour = await page.locator("#materialId option").nth(1).getAttribute("value");
  await page.selectOption("#materialId", colour!);
  await expect(page.locator("#thicknessMm")).not.toHaveValue("");
  await page.selectOption("#thicknessMm", "30");

  await page.getByRole("button", { name: "Open the job" }).click();
  await page.waitForURL(/\/orders\/(?!new)[^/]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`test kitchens ${stamp}`);
  await expect(page.getByText("Pat Homeowner")).toBeVisible();
  await expect(page.getByText(/· 30 mm ·/)).toBeVisible();
});

test("an installer cannot open the New job page", async ({ browser }) => {
  const page = await browser.newPage();
  await page.goto("/login");
  await page.selectOption("#demo-email", "installer@haskelproject.com.au");
  await page.fill("#demo-password", process.env.E2E_INSTALLER_PASSWORD ?? "");
  await page.click('button:has-text("Sign in with password")');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto("/orders/new");
  await expect(page).toHaveURL(/\/dashboard\?denied=/);
  await page.goto("/orders");
  await expect(page.getByRole("link", { name: "New job" })).toHaveCount(0);
  await page.close();
});

test("adding stock picks the stone from dropdowns", async ({ page }) => {
  await page.goto("/stock");
  await page.getByRole("button", { name: "Add stock" }).click();
  await page.getByRole("button", { name: /An offcut/ }).click();

  await page.selectOption("#stoneType", "NATURAL");
  const colour = await page.locator("#materialChoice option").nth(1).getAttribute("value");
  await page.selectOption("#materialChoice", colour!);
  await page.getByRole("button", { name: "Next" }).click();

  // Thickness and finish are dropdowns, already set from the colour.
  await expect(page.locator("select#thicknessMm")).not.toHaveValue("");
  await expect(page.locator("select#finish")).not.toHaveValue("");
  await page.fill("#widthMm", "600");
  await page.fill("#lengthMm", "900");
  await page.fill("#rack", "Z9");
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Put it on the rack" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("is on the rack");
});
