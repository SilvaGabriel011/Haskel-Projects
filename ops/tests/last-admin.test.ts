/**
 * The settings page can change roles, which means it can also remove the last
 * admin — and nobody could reach the financials again without a database edit.
 *
 * The rule lives in the server action, so this exercises the same query the
 * action uses rather than the action itself (which needs a session).
 */
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { db } from "../lib/db";

after(async () => { await db.$disconnect(); });

/** Mirrors wouldLeaveNoAdmin in app/(app)/settings/actions.ts */
async function otherActiveAdmins(userId: string) {
  return db.user.count({ where: { role: "ADMIN", active: true, id: { not: userId } } });
}

describe("the last admin", () => {
  it("the seed leaves exactly one admin, which is the case worth guarding", async () => {
    const admins = await db.user.count({ where: { role: "ADMIN", active: true } });
    assert.equal(admins, 1, "seed should have one admin — the risky configuration");
  });

  it("demoting the only admin would leave none, so it must be refused", async () => {
    const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
    assert.ok(admin);
    assert.equal(await otherActiveAdmins(admin.id), 0,
      "no other admin exists, so this change must be blocked");
  });

  it("with a second admin, demoting the first is safe", async () => {
    const [first, employee] = await Promise.all([
      db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } }),
      db.user.findFirst({ where: { role: "EMPLOYEE", active: true }, select: { id: true, role: true } }),
    ]);
    assert.ok(first && employee);

    await db.user.update({ where: { id: employee.id }, data: { role: "ADMIN" } });
    try {
      assert.equal(await otherActiveAdmins(first.id), 1, "the promoted user should now cover it");
    } finally {
      await db.user.update({ where: { id: employee.id }, data: { role: employee.role } });
    }
  });

  it("an inactive admin does not count as cover", async () => {
    const [admin, employee] = await Promise.all([
      db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } }),
      db.user.findFirst({ where: { role: "EMPLOYEE", active: true }, select: { id: true, role: true, active: true } }),
    ]);
    assert.ok(admin && employee);

    await db.user.update({ where: { id: employee.id }, data: { role: "ADMIN", active: false } });
    try {
      assert.equal(await otherActiveAdmins(admin.id), 0,
        "a deactivated admin must not be counted as remaining cover");
    } finally {
      await db.user.update({
        where: { id: employee.id },
        data: { role: employee.role, active: employee.active },
      });
    }
  });
});
