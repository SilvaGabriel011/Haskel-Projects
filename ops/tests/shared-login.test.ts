/**
 * Several people on one sign-in email: the PIN that says who is at the
 * keyboard, the lock after wrong guesses, the signed ticket that carries the
 * pick into the session, and the rules for adding someone to a login.
 */
import assert from "node:assert/strict";
import { before, describe, it } from "node:test";

import { hashPassword } from "../lib/password";
import { validatePerson } from "../lib/people";
import { PIN_TRIES, checkPin, makePickTicket, readPickTicket, validPin, wrongPinMessage } from "../lib/pin";

const INFO = "info@haskelproject.com.au";

before(() => {
  process.env.AUTH_SECRET ??= "test-secret-for-tickets";
});

describe("the PIN", () => {
  const mia = { name: "Mia", pinHash: hashPassword("2580"), pinLockedUntil: null };

  it("is four digits, nothing else", () => {
    for (const ok of ["0000", "2580"]) assert.ok(validPin(ok), ok);
    for (const bad of ["", "123", "12345", "12a4", " 1234"]) assert.ok(!validPin(bad), bad);
  });

  it("lets the right person in with the right PIN", () => {
    assert.deepEqual(checkPin(mia, "2580"), { ok: true });
  });

  it("counts a wrong one, and says how many tries are left", () => {
    const r = checkPin(mia, "1111");
    assert.ok(!r.ok && r.wrong);
    assert.match(wrongPinMessage("Mia", 1).reason, /4 more tries/);
    assert.match(wrongPinMessage("Mia", PIN_TRIES - 1).reason, /1 more try\b/);
  });

  it("locks after five wrong in a row", () => {
    const m = wrongPinMessage("Mia", PIN_TRIES);
    assert.ok(m.lock);
    assert.match(m.reason, /locked for 15 minutes/);
  });

  it("refuses even the right PIN while locked, and says for how long", () => {
    const now = new Date("2026-10-02T10:00:00Z");
    const locked = { ...mia, pinLockedUntil: new Date(now.getTime() + 9 * 60_000) };
    const r = checkPin(locked, "2580", now);
    assert.ok(!r.ok && !r.wrong);
    assert.match(r.reason, /9 minutes/);
    assert.deepEqual(checkPin(locked, "2580", new Date(now.getTime() + 10 * 60_000)), { ok: true });
  });

  it("has no way in for someone with no PIN set: an admin sets one", () => {
    const r = checkPin({ ...mia, pinHash: null }, "2580");
    assert.ok(!r.ok && !r.wrong);
    assert.match(r.reason, /no PIN yet/);
  });
});

describe("the pick ticket", () => {
  it("names the person picked, for the login it was made on", () => {
    assert.equal(readPickTicket(makePickTicket("person1", INFO), INFO), "person1");
    assert.equal(readPickTicket(makePickTicket("person1", INFO), "INFO@haskelproject.com.au"), "person1");
  });

  it("is worthless on another login, once expired, or once changed", () => {
    const t = makePickTicket("person1", INFO);
    assert.equal(readPickTicket(t, "admin@haskelproject.com.au"), null);
    assert.equal(readPickTicket(makePickTicket("person1", INFO, Date.now() - 120_000), INFO), null);
    assert.equal(readPickTicket(t.replace("person1", "person2"), INFO), null);
    assert.equal(readPickTicket(`${t}x`, INFO), null);
  });

  it("cannot be made up from the browser: a bare id is not a ticket", () => {
    for (const forged of ["person1", "person1.info@haskelproject.com.au.9999999999999", 42, null, undefined]) {
      assert.equal(readPickTicket(forged, INFO), null, String(forged));
    }
  });
});

describe("adding a person", () => {
  const ctx = { domain: "haskelproject.com.au", namesOnLogin: [] as string[] };
  const base = { name: "Tom Nguyen", email: "Tom@haskelproject.com.au", role: "EMPLOYEE" };

  it("on a login of their own needs no PIN", () => {
    const r = validatePerson(base, ctx);
    assert.ok(r.ok);
    assert.deepEqual(r.value, { name: "Tom Nguyen", email: "tom@haskelproject.com.au", role: "EMPLOYEE", pin: null });
  });

  it("joining a login already in use makes it shared, so needs a PIN", () => {
    const shared = { ...ctx, namesOnLogin: ["Mia Torres"] };
    const r = validatePerson({ ...base, email: INFO }, shared);
    assert.ok(!r.ok);
    assert.match(r.reason, /already used by Mia Torres.*needs a 4-digit PIN/);
    assert.ok(validatePerson({ ...base, email: INFO, pin: "1470" }, shared).ok);
  });

  it("refuses the same name twice on one login, an email off the domain, and a bad role", () => {
    const r = validatePerson({ ...base, name: "mia torres", email: INFO, pin: "1470" }, { ...ctx, namesOnLogin: ["Mia Torres"] });
    assert.ok(!r.ok && /already on/.test(r.reason));
    assert.ok(!validatePerson({ ...base, email: "tom@gmail.com" }, ctx).ok);
    assert.ok(!validatePerson({ ...base, role: "OWNER" }, ctx).ok);
    assert.ok(!validatePerson({ ...base, pin: "12" }, ctx).ok);
  });
});
