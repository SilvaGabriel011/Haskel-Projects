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
import { FINAL_STAGE, isStage } from "../lib/pipeline";

after(async () => { await db.$disconnect(); });

describe("seed integrity", () => {
  it("every stock movement names what moved", async () => {
    const orphans = await db.stockMovement.count({
      where: { slabId: null, offcutId: null, consumableId: null },
    });
    assert.equal(orphans, 0, `${orphans} movements name nothing`);
  });

  it("every order sits at a real stage", async () => {
    const orders = await db.order.findMany({ select: { jobNumber: true, status: true } });
    const bad = orders.filter((o) => o.status !== "LOST" && !isStage(o.status));
    assert.deepEqual(bad.map((o) => `${o.jobNumber}/${o.status}`), []);
  });

  it("every order has stage history, and exactly one open spell unless it is done", async () => {
    // Without an open spell the follow-up board cannot tell how long a job has
    // sat, and falls back to guessing from its creation date.
    const orders = await db.order.findMany({
      select: { jobNumber: true, status: true, stages: { select: { exitedAt: true } } },
    });
    const noHistory = orders.filter((o) => o.stages.length === 0);
    assert.deepEqual(noHistory.map((o) => o.jobNumber), [], "orders with no stage history");

    const bad = orders.filter((o) => {
      const open = o.stages.filter((s) => s.exitedAt === null).length;
      const settled = o.status === FINAL_STAGE || o.status === "LOST";
      return settled ? open !== 0 : open !== 1;
    });
    assert.deepEqual(bad.map((o) => `${o.jobNumber}/${o.status}`), [],
      "orders whose open spell does not match their status");
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
    const missing = await db.order.count({ where: { status: FINAL_STAGE, completedAt: null } });
    assert.equal(missing, 0);
    const premature = await db.order.count({ where: { status: { in: ["INITIAL", "QUOTE_REQUEST", "QUOTED"] }, completedAt: { not: null } } });
    assert.equal(premature, 0);
  });

  it("every order past QUOTED has at least one line", async () => {
    // Not every order: one created from a website booking sits at ENQUIRY with
    // nothing on it, because it has not been quoted yet. But once a job is won
    // it must have lines — revenueByMaterial attributes a job's revenue through
    // lines[0].material, so a won job with none would silently vanish from the
    // financials rather than show as zero.
    const without = await db.order.count({
      where: {
        lines: { none: {} },
        status: { in: ["ORDER_ACTIVE", "PURCHASE_ORDER", "MEASURED", "DETAILS", "FACTORY", "READY_FOR_DISPATCH", "INSTALLATION", "INVOICE"] },
      },
    });
    assert.equal(without, 0, "a won job with no lines would drop out of the revenue chart");
  });

  it("no completed job is missing from the revenue attribution", async () => {
    const { revenueByMaterial } = await import("../lib/queries/financials");
    const [attributed, completed] = await Promise.all([
      revenueByMaterial().then((rows) => rows.reduce((t, r) => t + r.cents, 0)),
      db.order.aggregate({ where: { status: FINAL_STAGE }, _sum: { quoteCents: true } }),
    ]);
    // Top 8 materials only, so attributed <= total; but it must not be far off,
    // which would mean jobs are falling through the attribution entirely.
    const total = completed._sum.quoteCents ?? 0;
    assert.ok(attributed > total * 0.8, `only ${attributed} of ${total} attributed to a material`);
  });

  it("the diary is not empty", async () => {
    // A status rename once left the schedule generator matching nothing, and
    // the seed reported "events: 0" without complaining.
    const events = await db.scheduleEvent.count();
    assert.ok(events > 20, `only ${events} schedule events — the generator matched nothing`);
  });

  it("some offcuts are flagged for the public website", async () => {
    const listed = await db.offcut.count({ where: { listedPublicly: true } });
    assert.ok(listed > 0, "the public offcuts page needs something to show");
  });
});

describe("pricing makes sense", () => {
  it("no completed job is quoted below the cost of its own stone", async () => {
    const jobs = await db.order.findMany({
      where: { status: FINAL_STAGE },
      select: {
        jobNumber: true, quoteCents: true,
        lines: { select: { sqm: true, offcutId: true, material: { select: { costPerSqmCents: true } } } },
      },
    });
    const underwater = jobs.filter((j) => {
      const stone = j.lines.reduce(
        (t, l) => t + (l.offcutId ? 0 : Math.round(l.sqm * (l.material?.costPerSqmCents ?? 0))),
        0,
      );
      return j.quoteCents < stone;
    });
    assert.deepEqual(underwater.map((j) => j.jobNumber), [],
      "jobs quoted below the cost of their own material");
  });

  it("the business as a whole makes money", async () => {
    const { summary } = await import("../lib/queries/financials");
    const s = await summary();
    assert.ok(s.margin > 0, `overall margin is ${s.marginPct}%`);
    assert.ok(s.marginPct > 15, `margin of ${s.marginPct}% does not look like a going concern`);
  });

  it("offcut work earns a better margin than slab work — the whole pitch", async () => {
    const { offcutComparison } = await import("../lib/queries/financials");
    const { offcut, other } = await offcutComparison();
    assert.ok(offcut.marginPct > other.marginPct,
      `offcut ${offcut.marginPct}% should beat slab ${other.marginPct}%`);
  });
});
