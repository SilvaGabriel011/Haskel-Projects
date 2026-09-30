/**
 * The booking endpoint is the only unauthenticated write in the app, so its
 * validation is the only place where hostile input is not hypothetical.
 */
import assert from "node:assert/strict";
import { after, beforeEach, describe, it } from "node:test";

import {
  _resetRateLimit,
  clientIp,
  MAX_TRACKED,
  rateLimit,
  trustedProxyHops,
  validateBooking,
  BOOKABLE,
} from "../lib/booking";
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
  it("reads the form's time as business time, not the server's", () => {
    // The datetime-local input sends "2026-09-18T09:00" with no zone. On a UTC
    // server that used to become 09:00 UTC: 5pm in Perth, eight hours late.
    const prev = process.env.BUSINESS_TIMEZONE;
    process.env.BUSINESS_TIMEZONE = "Australia/Perth";
    try {
      const r = validateBooking({ ...good, preferredAt: "2026-09-18T09:00" }, NOW);
      assert.ok(r.ok);
      assert.equal(r.ok && r.value.preferredAt.toISOString(), "2026-09-18T01:00:00.000Z");
    } finally {
      if (prev === undefined) delete process.env.BUSINESS_TIMEZONE;
      else process.env.BUSINESS_TIMEZONE = prev;
    }
  });

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

  it("cannot be reset by flooding it with new addresses", () => {
    // The map used to be emptied outright at its cap, the blocked sender's
    // own count included. Only the quietest entries may go now.
    const t0 = Date.now();
    for (let i = 0; i < 5; i++) rateLimit("6.6.6.6", t0);
    for (let i = 0; i < MAX_TRACKED + 10; i++) {
      rateLimit(`10.${(i >> 16) & 255}.${(i >> 8) & 255}.${i & 255}`, t0 + 1);
      // The blocked sender keeps trying throughout, as a real one would.
      if (i % 1000 === 0) rateLimit("6.6.6.6", t0 + 1);
    }
    assert.equal(rateLimit("6.6.6.6", t0 + 2).ok, false, "still limited after the flood");
  });
});

describe("who is asking", () => {
  const h = (xff?: string, real?: string) =>
    new Headers({ ...(xff ? { "x-forwarded-for": xff } : {}), ...(real ? { "x-real-ip": real } : {}) });

  it("ignores the entry the client wrote itself behind one proxy", () => {
    // The client sends "1.1.1.1"; our proxy appends the address it saw.
    const ip = clientIp(h("1.1.1.1, 203.0.113.9"), { onVercel: false, trustedHops: 1 });
    assert.equal(ip, "203.0.113.9");
  });

  it("gives a spoofer one bucket however many addresses they invent", () => {
    const seen = new Set(
      ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((fake) =>
        clientIp(h(`${fake}, 203.0.113.9`), { onVercel: false, trustedHops: 1 }),
      ),
    );
    assert.deepEqual([...seen], ["203.0.113.9"]);
  });

  it("counts in from the right when there are two proxies", () => {
    const ip = clientIp(h("1.1.1.1, 198.51.100.4, 10.0.0.2"), { onVercel: false, trustedHops: 2 });
    assert.equal(ip, "198.51.100.4");
  });

  it("trusts Vercel, which overwrites these headers itself", () => {
    assert.equal(clientIp(h("198.51.100.4", "198.51.100.4"), { onVercel: true, trustedHops: 1 }), "198.51.100.4");
    assert.equal(clientIp(h("198.51.100.4"), { onVercel: true, trustedHops: 1 }), "198.51.100.4");
  });

  it("trusts nothing when told there is no proxy", () => {
    assert.equal(clientIp(h("1.1.1.1", "2.2.2.2"), { onVercel: false, trustedHops: 0 }), "unknown");
  });

  it("does not run off the front of a short list", () => {
    assert.equal(clientIp(h("203.0.113.9"), { onVercel: false, trustedHops: 3 }), "unknown");
    assert.equal(clientIp(h(), { onVercel: false, trustedHops: 1 }), "unknown");
  });

  it("reads TRUSTED_PROXY_HOPS as a whole number, one by default", () => {
    assert.equal(trustedProxyHops(undefined), 1);
    assert.equal(trustedProxyHops(""), 1);
    assert.equal(trustedProxyHops("abc"), 1);
    assert.equal(trustedProxyHops("-1"), 1);
    assert.equal(trustedProxyHops("0"), 0);
    assert.equal(trustedProxyHops("2"), 2);
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

  it("guards every section, as Next itself compiles the matcher", async () => {
    // Reading the source only proves which words appear in it. An unanchored
    // "book" also matched "bookings", and the admin-only /bookings page ran
    // with no route guard at all. Compile the matcher the way Next does and
    // ask it about real paths instead.
    const { readFileSync } = await import("node:fs");
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { getMiddlewareMatchers } = require("next/dist/build/analysis/get-page-static-info");
    const { getMiddlewareRouteMatcher } = require("next/dist/shared/lib/router/utils/middleware-route-matcher");
    const { SECTIONS } = await import("../lib/roles");

    const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
    const literal = proxy.match(/matcher:\s*\[\s*("(?:[^"\\]|\\.)*")/)?.[1];
    assert.ok(literal, "matcher string not found in proxy.ts");
    const guarded = getMiddlewareRouteMatcher(getMiddlewareMatchers([JSON.parse(literal)], {}));
    const runs = (path: string) => guarded(path, { headers: {} }, {});

    for (const s of SECTIONS) {
      assert.ok(runs(s.href), `${s.href} must run through the guard`);
      assert.ok(runs(`${s.href}/x`), `${s.href}/x must run through the guard`);
    }
    for (const lookalike of ["/booking", "/books", "/api/bookings", "/api/authz", "/robots.txt.bak"]) {
      assert.ok(runs(lookalike), `${lookalike} must run through the guard`);
    }
    for (const open of ["/book", "/api/book", "/api/auth/session", "/_next/static/a.js", "/favicon.ico", "/robots.txt"]) {
      assert.ok(!runs(open), `${open} must stay public`);
    }
  });
});
