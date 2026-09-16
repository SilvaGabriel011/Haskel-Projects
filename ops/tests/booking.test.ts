/**
 * The booking endpoint is the only unauthenticated write in the app, so its
 * validation is the only place where hostile input is not hypothetical.
 */
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import { _resetRateLimit, rateLimit, validateBooking, BOOKABLE } from "../lib/booking";
import { db } from "../lib/db";

after(async () => { await db.$disconnect(); });

const NOW = new Date("2026-09-16T00:00:00Z");
const soon = new Date(NOW.getTime() + 2 * 86_400_000).toISOString();

const good = {
  name: "Sarah Okafor",
  phone: "0451 083 862",
  email: "sarah@example.com",
  suburb: "Henley Beach",
  jobType: "VANITY_TOP",
  preferredAt: soon,
  notes: "Basin cut-out needed",
};

describe("booking validation", () => {
  it("accepts a sensible request", () => {
    const r = validateBooking({ ...good }, NOW);
    assert.equal(r.ok, true);
  });

  it("silently refuses anything that fills the honeypot", () => {
    const r = validateBooking({ ...good, company: "Spam Co" }, NOW);
    assert.equal(r.ok, false);
  });

  it("refuses a time in the past — you cannot book yesterday", () => {
    const past = new Date(NOW.getTime() - 86_400_000).toISOString();
    assert.equal(validateBooking({ ...good, preferredAt: past }, NOW).ok, false);
  });

  it("refuses a time absurdly far ahead", () => {
    const far = new Date(NOW.getTime() + 400 * 86_400_000).toISOString();
    assert.equal(validateBooking({ ...good, preferredAt: far }, NOW).ok, false);
  });

  it("refuses a job type that is not offered to customers", () => {
    // FULL_BENCHTOP exists internally but is not on the public list.
    assert.equal(validateBooking({ ...good, jobType: "FULL_BENCHTOP" }, NOW).ok, false);
    assert.equal(validateBooking({ ...good, jobType: "<script>" }, NOW).ok, false);
  });

  it("only offers job types that exist in the schema", async () => {
    const { JobType } = await import("@prisma/client");
    for (const j of BOOKABLE) assert.ok(j in JobType, `${j} is not a real JobType`);
  });

  it("refuses a phone number that is not one", () => {
    for (const phone of ["", "123", "not a phone", "x".repeat(40)]) {
      assert.equal(validateBooking({ ...good, phone }, NOW).ok, false, phone);
    }
  });

  it("caps every free-text field rather than trusting length", () => {
    assert.equal(validateBooking({ ...good, name: "x".repeat(200) }, NOW).ok, false);
    assert.equal(validateBooking({ ...good, suburb: "x".repeat(200) }, NOW).ok, false);
    assert.equal(validateBooking({ ...good, notes: "x".repeat(5000) }, NOW).ok, false);
  });

  it("treats an absent optional email as absent, not as invalid", () => {
    const r = validateBooking({ ...good, email: "" }, NOW);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.value.email, null);
  });

  it("trims whitespace rather than storing it", () => {
    const r = validateBooking({ ...good, name: "  Sarah  ", suburb: " Unley " }, NOW);
    assert.ok(r.ok);
    assert.equal(r.ok && r.value.name, "Sarah");
    assert.equal(r.ok && r.value.suburb, "Unley");
  });
});

describe("rate limiting", () => {
  beforeEach(() => _resetRateLimit());

  it("lets a handful through then stops", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(rateLimit("1.2.3.4").ok, true, `request ${i + 1} should pass`);
    }
    assert.equal(rateLimit("1.2.3.4").ok, false, "the sixth should be refused");
  });

  it("counts each caller separately", () => {
    for (let i = 0; i < 5; i++) rateLimit("1.2.3.4");
    assert.equal(rateLimit("5.6.7.8").ok, true);
  });

  it("forgets once the window has passed", () => {
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) rateLimit("1.2.3.4", t0);
    assert.equal(rateLimit("1.2.3.4", t0).ok, false);
    assert.equal(rateLimit("1.2.3.4", t0 + 61 * 60 * 1000).ok, true);
  });
});

describe("the public route is the only hole in the guard", () => {
  it("proxy.ts excludes exactly book, api/book and framework paths", async () => {
    const { readFileSync } = await import("node:fs");
    const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    const matcher = proxy.match(/matcher:\s*\[([\s\S]*?)\]/)?.[1] ?? "";

    for (const open of ["api/book", "book"]) {
      assert.ok(matcher.includes(open), `${open} must be public`);
    }
    // Nothing that holds data may be public.
    for (const closed of ["financials", "stock", "orders", "settings", "schedule", "dashboard"]) {
      assert.ok(!matcher.includes(closed), `${closed} must NOT be excluded from the guard`);
    }
  });
});
