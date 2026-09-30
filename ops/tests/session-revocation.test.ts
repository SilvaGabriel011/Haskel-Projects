/**
 * Taking access away has to take effect.
 *
 * The role used to be stamped onto the token at sign-in and trusted for the
 * token's whole life, up to 30 days. Deactivating someone, or taking admin
 * away, changed the User row and nothing they could feel. These pin the
 * opposite: the row is re-read on every request.
 *
 * The second half runs against the real database with a real User row,
 * because "the row changed" is the whole point.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { revalidateToken, type StaffRecord } from "../lib/access-config";
import { db } from "../lib/db";

const staff = (over: Partial<StaffRecord> = {}): StaffRecord => ({
  id: "u1", email: "sam@haskelproject.com.au", name: "Sam", role: "ADMIN", active: true, ...over,
});

const token = { sub: "u1", email: "sam@haskelproject.com.au", name: "Sam", role: "ADMIN" as const };

describe("re-reading the session", () => {
  it("keeps an active person signed in", async () => {
    const t = await revalidateToken(token, async () => staff());
    assert.ok(t);
    assert.equal(t.role, "ADMIN");
  });

  it("ends the session of someone deactivated", async () => {
    assert.equal(await revalidateToken(token, async () => staff({ active: false })), null);
  });

  it("ends the session of someone deleted", async () => {
    assert.equal(await revalidateToken(token, async () => null), null);
  });

  it("applies a role change straight away, whatever the token says", async () => {
    const t = await revalidateToken(token, async () => staff({ role: "EMPLOYEE" }));
    assert.equal(t?.role, "EMPLOYEE");
  });

  it("picks up a new name", async () => {
    const t = await revalidateToken(token, async () => staff({ name: "Samantha" }));
    assert.equal(t?.name, "Samantha");
  });

  it("refuses a token with no one in it", async () => {
    let asked = false;
    const t = await revalidateToken({ ...token, sub: undefined }, async () => {
      asked = true;
      return staff();
    });
    assert.equal(t, null);
    assert.equal(asked, false);
  });
});

describe("against the User table", () => {
  const email = `revoke-${Date.now()}@haskelproject.com.au`;
  let id: string;
  const lookup = (uid: string) =>
    db.user.findUnique({ where: { id: uid }, select: { id: true, email: true, name: true, role: true, active: true } });

  before(async () => {
    id = (await db.user.create({ data: { email, name: "Revoke Test", role: "ADMIN" } })).id;
  });
  after(async () => {
    await db.user.deleteMany({ where: { id } });
    await db.$disconnect();
  });

  it("demoting an admin shows on their very next request", async () => {
    const signedIn = { sub: id, email, name: "Revoke Test", role: "ADMIN" as const };
    assert.equal((await revalidateToken(signedIn, lookup))?.role, "ADMIN");

    await db.user.update({ where: { id }, data: { role: "EMPLOYEE" } });
    assert.equal((await revalidateToken(signedIn, lookup))?.role, "EMPLOYEE");
  });

  it("deactivating someone signs them out on their very next request", async () => {
    const signedIn = { sub: id, email, name: "Revoke Test", role: "EMPLOYEE" as const };
    await db.user.update({ where: { id }, data: { active: false } });
    assert.equal(await revalidateToken(signedIn, lookup), null);
  });
});
