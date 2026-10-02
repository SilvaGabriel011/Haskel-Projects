/**
 * The activity record: every action keeps the owner (the login used) and the
 * user (the person on it), and a record outlives the person it names.
 */
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { record, recentActivity } from "../lib/activity";
import { db } from "../lib/db";

const TAG = `activity-${Date.now()}`;

after(async () => {
  await db.activity.deleteMany({ where: { action: TAG } });
  await db.$disconnect();
});

describe("the activity record", () => {
  it("keeps the owner and the user apart on a shared login", async () => {
    const tom = await db.user.findFirstOrThrow({ where: { email: "info@haskelproject.com.au", name: "Tom Nguyen" } });
    await record({ id: tom.id, name: tom.name, owner: "INFO@haskelproject.com.au" }, TAG, "Moved HP-0000-001 to Fabrication", "/orders/x");

    const [row] = await db.activity.findMany({ where: { action: TAG } });
    assert.equal(row.ownerEmail, "info@haskelproject.com.au");
    assert.equal(row.userId, tom.id);
    assert.equal(row.userName, "Tom Nguyen");
    assert.equal(row.href, "/orders/x");
    assert.ok((await recentActivity(200)).some((a) => a.action === TAG), "and Settings lists it");
  });

  it("never stops the work it describes, even when it cannot be written", async () => {
    // A user id that does not exist breaks the foreign key: logged, not thrown.
    await assert.doesNotReject(record({ id: "no-such-person", name: "Ghost", owner: "x@y.z" }, TAG, "nothing"));
  });
});
