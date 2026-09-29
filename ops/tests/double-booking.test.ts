/**
 * Two people, or one impatient double click, doing the same thing at once.
 *
 * These fire the calls truly concurrently (Promise.all) against the real
 * database, because the bugs they guard were invisible to one-at-a-time tests:
 * each call read "still free" before either wrote.
 *
 * Everything created here is removed afterwards, and the one seeded offcut
 * borrowed is put back as it was.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { acceptBookingRequest, declineBookingRequest } from "../lib/booking-accept";
import { findDuplicateRequests, overlaps, samePhone } from "../lib/conflicts";
import { db } from "../lib/db";
import { heldBy, releaseStock, reserveStock } from "../lib/reservations";

const TAG = `dbl-${Date.now()}`;
const madeRequests: string[] = [];
let adminId: string;

async function newRequest(over: Partial<{ phone: string; preferredAt: Date }> = {}) {
  const r = await db.bookingRequest.create({
    data: {
      name: `Test ${TAG}`,
      phone: over.phone ?? `04${Math.floor(Math.random() * 1e8).toString().padStart(8, "0")}`,
      suburb: "Testville",
      jobType: "REPAIR",
      notes: TAG,
      // Far future by default so it clashes with nothing seeded.
      preferredAt: over.preferredAt ?? new Date(Date.UTC(2031, 0, 1 + madeRequests.length, 2)),
    },
  });
  madeRequests.push(r.id);
  return r;
}

before(async () => {
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
  assert.ok(admin, "seed must contain an admin");
  adminId = admin.id;
});

after(async () => {
  const reqs = await db.bookingRequest.findMany({ where: { id: { in: madeRequests } }, select: { orderId: true } });
  const orderIds = reqs.flatMap((r) => (r.orderId ? [r.orderId] : []));
  const orders = await db.order.findMany({ where: { id: { in: orderIds } }, select: { customerId: true } });
  await db.bookingRequest.deleteMany({ where: { id: { in: madeRequests } } });
  await db.scheduleEvent.deleteMany({ where: { orderId: { in: orderIds } } });
  await db.order.deleteMany({ where: { id: { in: orderIds } } });
  await db.customer.deleteMany({ where: { id: { in: orders.map((o) => o.customerId) }, orders: { none: {} } } });
  await db.$disconnect();
});

describe("time overlap", () => {
  const at = (h: number) => new Date(Date.UTC(2030, 0, 1, h));
  it("back to back is not a clash", () => {
    assert.equal(overlaps(at(9), at(10), at(10), at(11)), false);
  });
  it("any shared minute is", () => {
    assert.equal(overlaps(at(9), at(11), at(10), at(12)), true);
    assert.equal(overlaps(at(9), at(12), at(10), at(11)), true);
  });
});

describe("accepting a request", () => {
  // The race tests confirm any clash up front: what they test is two callers
  // at once, and they must not depend on the diary happening to be empty.
  it("two accepts at the same moment make exactly one job", async () => {
    const r = await newRequest();
    const results = await Promise.all([
      acceptBookingRequest({ id: r.id, userId: adminId, confirmConflicts: true }),
      acceptBookingRequest({ id: r.id, userId: adminId, confirmConflicts: true }),
    ]);

    assert.equal(results.filter((x) => x.ok).length, 1, "exactly one accept may win");
    const loser = results.find((x) => !x.ok);
    assert.ok(loser && !loser.ok);
    assert.match(loser.reason, /already accepted/i);

    const events = await db.scheduleEvent.count({ where: { order: { booking: { id: r.id } } } });
    assert.equal(events, 1, "one diary entry, not two");
  });

  it("many accepts of different requests at once all get distinct job numbers", async () => {
    const reqs = await Promise.all([newRequest(), newRequest(), newRequest(), newRequest()]);
    const results = await Promise.all(reqs.map((r) => acceptBookingRequest({ id: r.id, userId: adminId, confirmConflicts: true })));
    const numbers = results.map((x) => (x.ok ? x.jobNumber : null));
    assert.ok(numbers.every(Boolean), `every accept should succeed: ${JSON.stringify(results.filter((x) => !x.ok))}`);
    assert.equal(new Set(numbers).size, numbers.length, "job numbers must be unique");
  });

  it("a clash with the diary asks first and writes nothing", async () => {
    const busy = await db.scheduleEvent.findFirst({
      where: { assignees: { some: { userId: adminId } } },
      select: { startAt: true },
    });
    assert.ok(busy, "seed must give the admin at least one diary entry");

    const r = await newRequest({ preferredAt: busy.startAt });
    const first = await acceptBookingRequest({ id: r.id, userId: adminId });
    assert.equal(first.ok, false);
    assert.ok(!first.ok && first.needsConfirmation, "should ask, not refuse outright");
    assert.ok(first.conflicts.length >= 1);

    const still = await db.bookingRequest.findUnique({ where: { id: r.id }, select: { status: true, orderId: true } });
    assert.deepEqual(still, { status: "NEW", orderId: null }, "nothing is booked until confirmed");

    const second = await acceptBookingRequest({ id: r.id, userId: adminId, confirmConflicts: true });
    assert.equal(second.ok, true, "confirming books it anyway");
  });

  it("a request already accepted cannot then be declined", async () => {
    const r = await newRequest();
    assert.equal((await acceptBookingRequest({ id: r.id, userId: adminId, confirmConflicts: true })).ok, true);
    const res = await declineBookingRequest(r.id);
    assert.equal(res.ok, false);
    assert.match(!res.ok ? res.reason : "", /already accepted/i);
  });
});

describe("possible duplicates", () => {
  it("the same number written differently is the same person", () => {
    assert.equal(samePhone("0451 083 862", "0451083862"), true);
    assert.equal(samePhone("0451 083 862", "0451 083 863"), false);
    assert.equal(samePhone("", ""), false, "two blanks are not a match");
  });

  it("flags both requests of a pair", async () => {
    const a = await newRequest({ phone: "0499 111 222" });
    const b = await newRequest({ phone: "0499111222" });
    const found = await findDuplicateRequests([a, b]);
    assert.deepEqual(found.get(a.id)?.map((d) => d.id), [b.id]);
    assert.deepEqual(found.get(b.id)?.map((d) => d.id), [a.id]);
  });
});

describe("holding stock", () => {
  let offcutId: string;
  let orders: string[];
  const created: string[] = [];

  before(async () => {
    const offcut = await db.offcut.findFirst({ where: { status: "AVAILABLE" }, select: { id: true } });
    assert.ok(offcut, "seed must contain an available offcut");
    offcutId = offcut.id;
    const open = await db.order.findMany({
      where: { status: { notIn: ["COMPLETE", "LOST"] } },
      select: { id: true },
      take: 2,
    });
    assert.equal(open.length, 2, "seed must contain two open jobs");
    orders = open.map((o) => o.id);
  });

  after(async () => {
    await db.offcut.update({ where: { id: offcutId }, data: { status: "AVAILABLE" } });
    await db.stockMovement.deleteMany({ where: { id: { in: created } } });
  });

  it("two jobs reaching for the same offcut at once: one gets it, the other is told who", async () => {
    const before = await db.stockMovement.count({ where: { offcutId, kind: "RESERVED" } });
    const [a, b] = await Promise.all(
      orders.map((orderId) => reserveStock({ kind: "offcut", itemId: offcutId, orderId, userId: adminId })),
    );

    assert.equal([a, b].filter((x) => x.ok).length, 1, "exactly one reservation may win");
    const loser = [a, b].find((x) => !x.ok);
    assert.ok(loser && !loser.ok);
    assert.match(loser.reason, /already held for HP-/, "the refusal names the job holding it");

    const after = await db.stockMovement.findMany({
      where: { offcutId, kind: "RESERVED" },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(after.length, before + 1, "one movement written, not two");
    created.push(after[0].id);
  });

  it("only the job holding it can release it", async () => {
    const holder = await heldBy("offcut", offcutId);
    assert.ok(holder);
    const other = orders.find((o) => o !== holder.orderId)!;

    const wrong = await releaseStock({ kind: "offcut", itemId: offcutId, orderId: other, userId: adminId });
    assert.equal(wrong.ok, false);

    const right = await releaseStock({ kind: "offcut", itemId: offcutId, orderId: holder.orderId, userId: adminId });
    assert.equal(right.ok, true);
    const now = await db.offcut.findUnique({ where: { id: offcutId }, select: { status: true } });
    assert.equal(now?.status, "AVAILABLE");

    const rel = await db.stockMovement.findFirst({
      where: { offcutId, kind: "RELEASED" },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (rel) created.push(rel.id);
  });

  it("a closed job cannot hold stock", async () => {
    const closed = await db.order.findFirst({ where: { status: "COMPLETE" }, select: { id: true } });
    assert.ok(closed);
    const res = await reserveStock({ kind: "offcut", itemId: offcutId, orderId: closed.id, userId: adminId });
    assert.equal(res.ok, false);
    assert.match(!res.ok ? res.reason : "", /closed/);
  });
});
