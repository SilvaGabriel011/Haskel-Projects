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
  await page.fill("#suburb", "Prospect");
  await page.fill("#siteContactName", "Pat Homeowner");

  await page.selectOption("#jobType", "VANITY_TOP");

  // Each list waits for the one before; thickness and finish fill in from the colour.
  await expect(page.locator("#stoneRange")).toBeDisabled();
  await expect(page.locator("#materialId")).toBeDisabled();
  await page.selectOption("#stoneType", "ENGINEERED");
  await page.selectOption("#stoneRange", "file");
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

test("the stone narrows step by step, offering first what the colour is made in", async ({ page }) => {
  await page.goto("/orders/new");
  const options = (id: string) =>
    page.locator(`#${id} option:not([value=""])`).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));
  // What a colour is made in sits in its own group, above everything else the trade sells.
  const madeIn = (id: string) =>
    page.locator(`#${id} optgroup[label="Made in"] option`).evaluateAll((os) => os.map((o) => (o as HTMLOptionElement).value));

  await page.selectOption("#stoneType", "SINTERED");
  expect(await options("stoneRange")).toEqual(expect.arrayContaining(["dekton", "neolith"]));
  await page.selectOption("#stoneRange", "neolith");
  await page.selectOption("#materialId", "cat:neolith:Arctic White");
  // Made 12 mm only, so it is picked; its own finishes come first.
  await expect(page.locator("#thicknessMm")).toHaveValue("12");
  expect(await madeIn("thicknessMm")).toEqual(["12"]);
  expect(await madeIn("finish")).toEqual(["Silk", "Polished", "Satin"]);
  // The rest are still there, and anything else can be typed.
  expect(await options("thicknessMm")).toEqual(expect.arrayContaining(["20", "30", "40", "__other"]));

  // Changing the brand clears the colour and what followed it.
  await page.selectOption("#stoneRange", "dekton");
  await expect(page.locator("#materialId")).toHaveValue("");
  await expect(page.locator("#thicknessMm")).toBeDisabled();
  await page.selectOption("#materialId", "cat:dekton:Lunar");
  expect(await madeIn("thicknessMm")).toEqual(["8", "12", "20", "30"]);
  expect(await madeIn("finish")).toEqual(["Matte"]);
});

test("a size off the maker's list is flagged, a size not listed can be typed, and the edge goes on the job", async ({
  page,
}) => {
  await page.goto("/orders/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.fill("#address", "1 Test St");
  await page.fill("#suburb", "Unley");
  await page.selectOption("#jobType", "VANITY_TOP");
  await page.selectOption("#stoneType", "SINTERED");
  await page.selectOption("#stoneRange", "dekton");
  await page.selectOption("#materialId", "cat:dekton:Lunar");

  // 40 mm is offered, under the other sizes, and flagged rather than refused.
  await page.selectOption("#thicknessMm", "40");
  await expect(page.getByRole("status").filter({ hasText: "Dekton Lunar is not listed in 40 mm" })).toBeVisible();

  // A size on no list is typed in.
  await page.selectOption("#thicknessMm", "__other");
  await page.getByRole("textbox", { name: "Thickness, typed in" }).fill("15");
  await expect(page.getByRole("status").filter({ hasText: "not listed in 15 mm" })).toBeVisible();

  await page.selectOption("#edge", "40 mm mitred");
  await page.getByRole("button", { name: "Open the job" }).click();
  await page.waitForURL(/\/orders\/(?!new)[^/]+$/);
  await expect(page.getByText("Dekton Lunar · 15 mm · Matte · 40 mm mitred edge")).toBeVisible();
});

test("a stone is found by typing, sets the lists, and one not listed can be added", async ({ page }) => {
  const stamp = Date.now().toString().slice(-7);
  await page.goto("/orders/new");
  const search = page.getByRole("combobox", { name: "Find a stone" });

  // Typing finds a catalogue colour; picking it fills in the dropdowns.
  await search.fill("lunar dek");
  await page.getByRole("option", { name: /Dekton Lunar/ }).click();
  await expect(page.locator("#stoneType")).toHaveValue("SINTERED");
  await expect(page.locator("#stoneRange")).toHaveValue("dekton");
  await expect(page.locator("#materialId")).toHaveValue("cat:dekton:Lunar");
  await expect(page.locator("#thicknessMm")).toHaveValue("20");

  // A name on no list is offered, picked with the keyboard, and takes any finish typed.
  await search.fill(`Blue Bahia ${stamp}`);
  await expect(page.getByRole("option", { name: /as a new stone/ })).toBeVisible();
  await search.press("ArrowDown");
  await search.press("Enter");
  await expect(page.getByText(`New stone: Blue Bahia ${stamp}`)).toBeVisible();
  await expect(page.locator("#stoneType")).toHaveCount(0);
  await page.selectOption("#thicknessMm", "__other");
  await page.getByRole("textbox", { name: "Thickness, typed in" }).fill("25");
  await page.selectOption("#finish", "Brushed");

  await page.selectOption("#customerId", { index: 1 });
  await page.fill("#address", "1 Test St");
  await page.fill("#suburb", "Unley");
  await page.selectOption("#jobType", "VANITY_TOP");
  await page.getByRole("button", { name: "Open the job" }).click();
  await page.waitForURL(/\/orders\/(?!new)[^/]+$/);
  await expect(page.getByText(`Blue Bahia ${stamp} · 25 mm · Brushed`)).toBeVisible();

  // Next time, it is the most recent pick, before anything is typed.
  await page.goto("/orders/new");
  await page.getByRole("combobox", { name: "Find a stone" }).focus();
  const listbox = page.getByRole("listbox", { name: "Stones" });
  await expect(listbox.getByText("Recently chosen")).toBeVisible();
  await expect(listbox.getByRole("option").first()).toContainText(`Blue Bahia ${stamp}`);
});

test("a client is found by typing, and one not on file starts a new profile", async ({ page }) => {
  await page.goto("/orders/new");
  const search = page.getByRole("combobox", { name: "Find a client" });

  // By any part of the phone number, however it was written.
  await search.fill("8356");
  const found = page.getByRole("listbox", { name: "Clients" });
  await found.getByRole("option", { name: "Seaview Builders" }).click();
  await expect(page.locator("#customerId option:checked")).toContainText("Seaview Builders");
  await expect(page.locator("#suburb")).toHaveValue("Glenelg");

  // A name not on file offers a new profile, with the name filled in.
  await search.fill("Jo Newperson");
  await found.getByRole("option", { name: /Create a client profile “Jo Newperson”/ }).click();
  await expect(page.locator("#clientName")).toHaveValue("Jo Newperson");
});

test("the target, its reminders and the email choice reach the job page", async ({ page }) => {
  await page.goto("/orders/new");
  await page.getByRole("combobox", { name: "Find a client" }).fill("hills");
  await page.getByRole("listbox", { name: "Clients" }).getByRole("option", { name: "Hills Kitchens" }).click();
  await page.fill("#address", "1 Test St");

  // The kind of job sets a starting target: four weeks for a benchtop.
  const today = await page.locator("#targetDate").getAttribute("min");
  const plus = (days: number) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  await page.selectOption("#jobType", "FULL_BENCHTOP");
  await expect(page.locator("#targetDate")).toHaveValue(plus(28));
  await page.getByRole("radio", { name: "2 weeks" }).click();
  await expect(page.locator("#targetDate")).toHaveValue(plus(14));
  // Choosing the job again leaves a target someone set alone.
  await page.selectOption("#jobType", "SPLASHBACK");
  await expect(page.locator("#targetDate")).toHaveValue(plus(14));

  // Reminders start unticked; tick the ones wanted.
  for (const r of ["2 weeks before", "1 week before", "3 days before", "1 day before"]) {
    await expect(page.getByRole("checkbox", { name: r })).not.toBeChecked();
  }
  await page.getByRole("checkbox", { name: "1 week before" }).check();
  await page.getByRole("checkbox", { name: "3 days before" }).check();

  // The client is emailed without anyone ticking anything; CI has no mail service, and says so.
  await expect(page.getByText("The client is emailed automatically")).toBeVisible();
  await expect(page.getByText(/Once email is set up/)).toBeVisible();

  await page.getByRole("button", { name: "Open the job" }).click();
  await page.waitForURL(/\/orders\/(?!new)[^/]+$/);
  await expect(page.getByRole("status").filter({ hasText: "Job opened." })).toBeVisible();
  await expect(page.getByText(/^Target: /)).toBeVisible();
  await expect(page.getByText("Reminders 1 week before, 3 days before")).toBeVisible();

  // The client's email and phone open the mail app and the dialler.
  await expect(page.getByRole("link", { name: "jobs@hillskitchens.example.com" })).toHaveAttribute(
    "href",
    /^mailto:jobs@hillskitchens\.example\.com\?subject=Your%20job%20HP-/,
  );
  await expect(page.getByRole("link", { name: "08 8370 1200" })).toHaveAttribute("href", "tel:0883701200");
});

test("the suburb follows the client picked, takes a town off the list, and a typed one stays", async ({ page }) => {
  await page.goto("/orders/new");
  // The two seeded companies live in different suburbs.
  const pick = (name: string) =>
    page.locator("#customerId option", { hasText: name }).first().getAttribute("value");
  await page.selectOption("#customerId", (await pick("Hills Kitchens"))!);
  await expect(page.locator("#suburb")).toHaveValue("Stirling");
  await page.selectOption("#customerId", (await pick("Seaview Builders"))!);
  await expect(page.locator("#suburb")).toHaveValue("Glenelg");

  await page.fill("#suburb", "Coober Pedy");
  await page.selectOption("#customerId", (await pick("Hills Kitchens"))!);
  await expect(page.locator("#suburb")).toHaveValue("Coober Pedy");
});

test("a dropped connection says so and lets you try again", async ({ page }) => {
  await page.goto("/orders/new");
  await page.selectOption("#customerId", { index: 1 });
  await page.fill("#address", "1 Test St");
  await page.selectOption("#jobType", "REPAIR");
  // Lose the save request, as a phone dropping signal would.
  await page.route("**/orders/new", (r) =>
    r.request().method() === "POST" ? r.abort("internetdisconnected") : r.continue(),
  );
  await page.getByRole("button", { name: "Open the job" }).click();
  await expect(page.locator("form").getByRole("alert")).toContainText("did not go through");
  await expect(page.getByRole("button", { name: "Open the job" })).toBeEnabled();
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

test("a colour from the catalogue fills in the new material, leaving only the cost", async ({ page }) => {
  await page.goto("/stock");
  await page.getByRole("button", { name: "Add stock" }).click();
  await page.getByRole("button", { name: /A slab/ }).click();
  await page.selectOption("#stoneType", "ENGINEERED");
  await page.selectOption("#materialChoice", "cat:caesarstone-mineral:Rugged Concrete");
  await expect(page.locator("#materialName")).toHaveValue("Caesarstone Rugged Concrete");
  await expect(page.locator("#materialFinish")).toHaveValue("Rough");
  await expect(page.locator("#materialThicknessMm")).toHaveValue("20");
  await expect(page.locator("#materialSupplier")).toHaveValue("Caesarstone");
  await expect(page.locator("#materialCostPerSqm")).toHaveValue("");
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
  // A thickness on no list is typed in, and read back before anything is written.
  await page.selectOption("select#thicknessMm", "__other");
  await page.getByRole("textbox", { name: "Thickness, typed in" }).fill("18");
  await page.fill("#widthMm", "600");
  await page.fill("#lengthMm", "900");
  await page.fill("#rack", "Z9");
  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByRole("dialog")).toContainText("18 mm");
  await page.getByRole("button", { name: "Put it on the rack" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("is on the rack");
});
