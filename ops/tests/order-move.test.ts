/**
 * Moving a job along, against the real database.
 *
 * The double click is fired truly concurrently (Promise.all), because the bug
 * it guards was invisible one call at a time: both calls read the old stage
 * before either wrote, both passed the check, and the job got two spells for
 * one move.
 *
 * Everything created here is removed afterwards.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "../lib/db";
import { moveOrder } from "../lib/order-move";
import { heldBy, reserveStock } from "../lib/reservations";

const TAG = `move-${Date.now()}`;
const orderIds: string[] = [];
const offcutIds: string[] = [];
let adminId: string;
let customerId: string;
let materialId: string;

async function newOrder(status: "INITIAL" | "QUOTED" = "INITIAL") {
  const o = await db.order.create({
    data: {
      jobNumber: `${TAG}-${orderIds.length}`,
      customerId,
      pipeline: "SHORT",
      jobType: "REPAIR",
      status,
      address: "1 Test St",
      suburb: "Testville",
      stages: { create: { stage: status, enteredAt: new Date(Date.now() - 60_000) } },
    },
  });
  orderIds.push(o.id);
  return o;
}

before(async () => {
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
  const material = await db.material.findFirst({ select: { id: true } });
  assert.ok(admin && material, "seed must contain an admin and a material");
  adminId = admin.id;
  materialId = material.id;
  customerId = (await db.customer.create({ data: { name: TAG, phone: "0400000000", suburb: "Testville", source: "PHONE" } })).id;
});

after(async () => {
  await db.stockMovement.deleteMany({ where: { OR: [{ orderId: { in: orderIds } }, { offcutId: { in: offcutIds } }] } });
  await db.offcut.deleteMany({ where: { id: { in: offcutIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.customer.deleteMany({ where: { id: customerId } });
  await db.$disconnect();
});

describe("moving a job", () => {
  it("a double click moves the job once, with one new spell", async () => {
    const o = await newOrder();

    const results = await Promise.all([
      moveOrder({ orderId: o.id, to: "QUOTE_REQUEST", userId: adminId, role: "ADMIN" }),
      moveOrder({ orderId: o.id, to: "QUOTE_REQUEST", userId: adminId, role: "ADMIN" }),
    ]);

    assert.equal(results.filter((r) => r.ok).length, 1, JSON.stringify(results));
    const loser = results.find((r) => !r.ok);
    assert.ok(loser && !loser.ok && /Quote Request/.test(loser.reason), JSON.stringify(loser));

    const spells = await db.orderStage.findMany({ where: { orderId: o.id }, orderBy: { enteredAt: "asc" } });
    assert.deepEqual(spells.map((s) => s.stage), ["INITIAL", "QUOTE_REQUEST"]);
    assert.equal(spells.filter((s) => s.exitedAt === null).length, 1);
  });

  it("still refuses a skipped step and an employee on an office stage", async () => {
    const o = await newOrder();
    const skip = await moveOrder({ orderId: o.id, to: "QUOTED", userId: adminId, role: "ADMIN" });
    assert.equal(skip.ok, false);

    const q = await newOrder("QUOTED");
    const emp = await moveOrder({ orderId: q.id, to: "ORDER_ACTIVE", userId: adminId, role: "EMPLOYEE" });
    assert.equal(emp.ok, false);
    assert.equal((await db.order.findUniqueOrThrow({ where: { id: q.id } })).status, "QUOTED");
  });

  it("marking a job lost puts the stock it held back on the rack", async () => {
    const o = await newOrder("QUOTED");
    const piece = await db.offcut.create({
      data: { ref: `OFF-${TAG}`, materialId, widthMm: 600, lengthMm: 900, finish: "Polished", rack: "T1" },
    });
    offcutIds.push(piece.id);

    const held = await reserveStock({ kind: "offcut", itemId: piece.id, orderId: o.id, userId: adminId });
    assert.equal(held.ok, true);

    const lost = await moveOrder({ orderId: o.id, to: "LOST", userId: adminId, role: "ADMIN" });
    assert.equal(lost.ok, true);

    assert.equal((await db.offcut.findUniqueOrThrow({ where: { id: piece.id } })).status, "AVAILABLE");
    const released = await db.stockMovement.count({ where: { offcutId: piece.id, orderId: o.id, kind: "RELEASED" } });
    assert.equal(released, 1);
    // A lost job opens no spell and leaves none open.
    assert.equal(await db.orderStage.count({ where: { orderId: o.id, exitedAt: null } }), 0);
  });

  it("losing a job leaves alone a piece another job holds now", async () => {
    const first = await newOrder("QUOTED");
    const second = await newOrder("QUOTED");
    const piece = await db.offcut.create({
      data: { ref: `OFF-${TAG}-b`, materialId, widthMm: 600, lengthMm: 900, finish: "Polished", rack: "T1" },
    });
    offcutIds.push(piece.id);

    // First held it, gave it back, and second took it.
    await db.stockMovement.create({ data: { kind: "RESERVED", offcutId: piece.id, orderId: first.id, userId: adminId } });
    await db.stockMovement.create({ data: { kind: "RELEASED", offcutId: piece.id, orderId: first.id, userId: adminId } });
    assert.equal((await reserveStock({ kind: "offcut", itemId: piece.id, orderId: second.id, userId: adminId })).ok, true);

    assert.equal((await moveOrder({ orderId: first.id, to: "LOST", userId: adminId, role: "ADMIN" })).ok, true);

    assert.equal((await db.offcut.findUniqueOrThrow({ where: { id: piece.id } })).status, "RESERVED");
    assert.equal((await heldBy("offcut", piece.id))?.orderId, second.id);
  });
});
