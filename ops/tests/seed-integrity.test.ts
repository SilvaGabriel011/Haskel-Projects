/**
 * Guards against demo data that looks plausible but is useless.
 *
 * The movement-log check earned its place: the first seed attached stock only
 * to offcut jobs, so half the log read "RESERVED —" with nothing naming what
 * had moved.
 */
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { db } from "../lib/db";
import { belongsTo } from "../lib/pipeline";

after(async () => { await db.$disconnect(); });

describe("seed integrity", () => {
  it("every stock movement names what moved", async () => {
    const orphans = await db.stockMovement.count({
      where: { slabId: null, offcutId: null, consumableId: null },
    });
    assert.equal(orphans, 0, `${orphans} movements name nothing`);
  });

  it("every order status is legal for its pipeline", async () => {
    const orders = await db.order.findMany({ select: { jobNumber: true, pipeline: true, status: true } });
    const bad = orders.filter((o) => !belongsTo(o.pipeline, o.status));
    assert.deepEqual(bad.map((o) => `${o.jobNumber}:${o.pipeline}/${o.status}`), []);
  });

  it("every offcut points at a real parent slab", async () => {
    const orphan = await db.offcut.count({ where: { parentSlabId: null } });
    assert.equal(orphan, 0);
  });

  it("short-pipeline work dominates, as the business does", async () => {
    const [short, full] = await Promise.all([
      db.order.count({ where: { pipeline: "SHORT" } }),
      db.order.count({ where: { pipeline: "FULL" } }),
    ]);
    assert.ok(short > full * 2, `expected short to dominate, got ${short}/${full}`);
  });

  it("completed orders have a completion date, open ones do not", async () => {
    const missing = await db.order.count({ where: { status: "COMPLETE", completedAt: null } });
    assert.equal(missing, 0);
    const premature = await db.order.count({ where: { status: { in: ["ENQUIRY", "QUOTED"] }, completedAt: { not: null } } });
    assert.equal(premature, 0);
  });

  it("every order has at least one line", async () => {
    const without = await db.order.count({ where: { lines: { none: {} } } });
    assert.equal(without, 0);
  });

  it("some offcuts are flagged for the public website", async () => {
    const listed = await db.offcut.count({ where: { listedPublicly: true } });
    assert.ok(listed > 0, "the public offcuts page needs something to show");
  });
});
