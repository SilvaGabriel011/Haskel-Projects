/**
 * Same assertion as the order leak test, applied to stock: an installer may see
 * which slab, what size and which rack — never what it cost.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "../lib/db";
import { getSlab, listConsumables, listSlabs, stockCounts } from "../lib/queries/stock";

const MONEY_KEYS = ["costCents", "costPerSqmCents", "unitCostCents"];

function moneyKeysIn(obj: unknown, path = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  if (obj instanceof Date) return [];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => moneyKeysIn(v, `${path}[${i}]`));
  return Object.entries(obj).flatMap(([k, v]) => [
    ...(MONEY_KEYS.includes(k) ? [`${path}.${k}`] : []),
    ...moneyKeysIn(v, `${path}.${k}`),
  ]);
}

let slabId: string;

before(async () => {
  const s = await db.slab.findFirst({ where: { status: "CUT" }, select: { id: true } });
  assert.ok(s, "seed must contain a cut slab — run npm run db:seed");
  slabId = s.id;
});

after(async () => { await db.$disconnect(); });

describe("stock: an employee sees the rack, not the cost", () => {
  it("listSlabs leaks no cost anywhere", async () => {
    const slabs = await listSlabs("EMPLOYEE");
    assert.ok(slabs.length > 10);
    assert.deepEqual(moneyKeysIn(slabs), []);
  });

  it("the supplier is withheld too — it is commercial information", async () => {
    const slabs = await listSlabs("EMPLOYEE");
    assert.ok(!("supplier" in slabs[0].material));
  });

  it("getSlab leaks nothing, including through offcuts and history", async () => {
    const slab = await getSlab(slabId, "EMPLOYEE");
    assert.ok(slab);
    assert.deepEqual(moneyKeysIn(slab), []);
  });

  it("but still gives them what they need on site", async () => {
    const slab = await getSlab(slabId, "EMPLOYEE");
    assert.ok(slab!.ref);
    assert.ok(slab!.rack);
    assert.ok(slab!.widthMm > 0);
    assert.ok(slab!.material.name);
  });

  it("consumables show quantity but not unit cost", async () => {
    const rows = await listConsumables("EMPLOYEE");
    assert.ok(rows.length > 0);
    assert.deepEqual(moneyKeysIn(rows), []);
    assert.ok(rows[0].qtyOnHand >= 0);
  });
});

describe("stock: an admin does see it", () => {
  it("listSlabs carries cost and supplier", async () => {
    const slabs = await listSlabs("ADMIN");
    assert.equal(typeof slabs[0].costCents, "number");
    assert.ok("supplier" in slabs[0].material);
  });

  it("consumables carry unit cost", async () => {
    const rows = await listConsumables("ADMIN");
    assert.equal(typeof rows[0].unitCostCents, "number");
  });
});

describe("counts both roles can see", () => {
  it("returns no money", async () => {
    const counts = await stockCounts();
    assert.deepEqual(moneyKeysIn(counts), []);
    assert.ok(counts.offcutsAvailable > 0);
  });
});
