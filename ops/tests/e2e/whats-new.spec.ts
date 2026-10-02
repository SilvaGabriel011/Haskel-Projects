import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";

import { whatsNewFor } from "../../lib/releases";

/**
 * Telling people already using the app what changed, once, and where the
 * version lives. Needs a freshly seeded database, where nobody has seen the
 * current release yet — as CI has.
 */
const version = (JSON.parse(readFileSync("package.json", "utf8")) as { version: string }).version;

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  expect(password, `set the password for ${email}`).not.toBe("");
  await page.goto("/login");
  await page.selectOption("#demo-email", email);
  await page.fill("#demo-password", password);
  await page.click('button:has-text("Sign in with password")');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

test("an installer is told once what changed for them, and Got it puts it away", async ({ page }) => {
  await signIn(page, "installer@haskelproject.com.au", process.env.E2E_INSTALLER_PASSWORD ?? "");
  await page.goto("/dashboard");
  const card = page.getByRole("region", { name: "What’s new" });
  // What a freshly seeded installer is owed, by the rule itself, so a new
  // release does not break the test.
  const owed = whatsNewFor({ onboardedAt: new Date(), seenVersion: null }, "EMPLOYEE")!;
  await expect(card).toContainText(`Version ${owed[0].release.version}`);
  for (const item of owed[0].items) await expect(card).toContainText(item.text);
  // Admin-only news is not theirs.
  for (const item of owed[0].release.items.filter((i) => i.roles && !i.roles.includes("EMPLOYEE"))) {
    await expect(card).not.toContainText(item.text);
  }

  await card.getByRole("button", { name: "Got it" }).click();
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("region", { name: "What’s new" })).toHaveCount(0);
});

test("Settings shows the version and every change", async ({ page }) => {
  await signIn(page, "admin@haskelproject.com.au", process.env.E2E_ADMIN_PASSWORD ?? "");
  await page.goto("/settings#version");
  const section = page.locator("#version");
  await expect(section).toContainText(`Haskel Ops ${version}`);
  await expect(section.getByRole("listitem").filter({ hasText: "Open jobs by hand" }).first()).toBeVisible();
  await expect(section).toContainText("1.0.0");
});
