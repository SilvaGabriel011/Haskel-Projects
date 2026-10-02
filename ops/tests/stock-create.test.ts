/**
 * Add stock's writing half, against the real database.
 *
 * Everything made here is removed afterwards; colours are named for this run
 * so they never meet the seed's.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "../lib/db";
import { addStock } from "../lib/stock-create";
import type { StockInput } from "../lib/stock-input";

const TAG = `stock-${Date.now()}`;
let adminId: string;

const newColour = (name: string) => ({
  name,
  kind: "ENGINEERED" as const,
  supplier: "Test Supplier",
  thicknessMm: 20,
  finish: "Polished",
  costPerSqmCents: 10_000,
});

const offcut = (over: Partial<Extract<StockInput, { kind: "OFFCUT" }>>): StockInput => ({
  kind: "OFFCUT",
  materialId: null,
  newMaterial: null,
  parentSlabId: null,
  widthMm: 600,
  lengthMm: 900,
  thicknessMm: 20,
  finish: "Polished",
  rack: "T1",
  listedPublicly: false,
  notes: TAG,
  ...over,
});

before(async () => {
  const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
  assert.ok(admin, "seed must contain an admin");
  adminId = admin.id;
});

after(async () => {
  const offcuts = await db.offcut.findMany({ where: { notes: TAG }, select: { id: true } });
  await db.stockMovement.deleteMany({ where: { offcutId: { in: offcuts.map((o) => o.id) } } });
  await db.offcut.deleteMany({ where: { notes: TAG } });
  await db.material.deleteMany({ where: { name: { startsWith: TAG } } });
  await db.$disconnect();
});

describe("adding stock", () => {
  it("does not add a colour already on file under different capitals", async () => {
    const onFile = await db.material.findFirstOrThrow({ select: { name: true } });
    const res = await addStock(offcut({ newMaterial: newColour(onFile.name.toUpperCase()) }), adminId);
    assert.equal(res.ok, false);
    assert.match(!res.ok ? res.reason : "", new RegExp(`${onFile.name} is already on file`));
    assert.equal(
      await db.material.count({ where: { name: { equals: onFile.name, mode: "insensitive" } } }),
      1,
      "still one of that colour",
    );
  });

  it("leaves no new colour behind when the piece is refused", async () => {
    const slab = await db.slab.findFirstOrThrow({ select: { id: true } });
    const name = `${TAG} Orphan`;
    // A brand-new colour cannot have been cut from a slab already on file.
    const res = await addStock(offcut({ newMaterial: newColour(name), parentSlabId: slab.id }), adminId);
    assert.equal(res.ok, false);
    assert.equal(await db.material.count({ where: { name } }), 0, "the colour rolled back with the piece");

    const again = await addStock(offcut({ newMaterial: newColour(name) }), adminId);
    assert.equal(again.ok, true, "so trying again without the slab saves");
  });

  it("will not link an offcut to a slab of another colour", async () => {
    const slab = await db.slab.findFirstOrThrow({ select: { id: true, ref: true, materialId: true } });
    const other = await db.material.findFirstOrThrow({ where: { id: { not: slab.materialId } }, select: { id: true } });
    const res = await addStock(offcut({ materialId: other.id, parentSlabId: slab.id }), adminId);
    assert.equal(res.ok, false);
    assert.match(!res.ok ? res.reason : "", new RegExp(`${slab.ref} is`));
  });

  it("links it when the slab is the same stone", async () => {
    const slab = await db.slab.findFirstOrThrow({ select: { id: true, materialId: true } });
    const res = await addStock(offcut({ materialId: slab.materialId, parentSlabId: slab.id }), adminId);
    assert.ok(res.ok);
    const made = await db.offcut.findFirstOrThrow({ where: { ref: res.ref }, select: { parentSlabId: true } });
    assert.equal(made.parentSlabId, slab.id);
    const moved = await db.stockMovement.count({ where: { offcut: { ref: res.ref }, kind: "RECEIVED" } });
    assert.equal(moved, 1, "the arrival is on the audit trail");
  });
});
