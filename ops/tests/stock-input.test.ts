/**
 * The add-stock rules.
 *
 * The modal validates too, but that is a courtesy. createStock is a server
 * action — its own endpoint, callable without the form ever being opened — so
 * these are the checks that actually hold, and they are worth testing directly.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { dollarsToCents, nextRef, validateStock } from "../lib/stock-input";

const NOW = new Date("2026-09-29T00:00:00Z");

const MATERIAL = {
  materialName: "Calacatta Gold",
  materialKind: "ENGINEERED",
  materialSupplier: "Coastline Stone Co",
  materialFinish: "Polished",
  materialThicknessMm: "20",
  materialCostPerSqm: "480",
};

const SLAB = {
  kind: "SLAB",
  materialId: "mat_1",
  widthMm: "1400",
  lengthMm: "3200",
  rack: "A3",
  cost: "2150",
  arrivedAt: "2026-09-28",
};

const OFFCUT = {
  kind: "OFFCUT",
  materialId: "mat_1",
  widthMm: "980",
  lengthMm: "540",
  thicknessMm: "20",
  finish: "Matte",
  rack: "B1",
};

const CONSUMABLE = {
  kind: "CONSUMABLE",
  name: "Silicone adhesive",
  unit: "tube",
  qtyOnHand: "24",
  reorderPoint: "6",
  unitCost: "12.50",
};

describe("money never becomes a float", () => {
  it("reads plain dollars as cents", () => {
    assert.equal(dollarsToCents("2150"), 215_000);
  });

  it("reads cents without the rounding error", () => {
    assert.equal(dollarsToCents("12.50"), 1250);
    assert.equal(dollarsToCents("0.10"), 10);
    // 10.10 * 100 is 1009.9999999999999 in binary floating point.
    assert.equal(dollarsToCents("10.10"), 1010);
  });

  it("tolerates how a person actually types an amount", () => {
    assert.equal(dollarsToCents("$1,200.50"), 120_050);
    assert.equal(dollarsToCents("  480 "), 48_000);
  });

  it("refuses a third decimal rather than guessing which way to round", () => {
    assert.equal(dollarsToCents("10.005"), null);
  });

  it("refuses what is not an amount", () => {
    for (const bad of ["", "abc", "-5", "1e3", "12.", ".5", "1.2.3"]) {
      assert.equal(dollarsToCents(bad), null, `${JSON.stringify(bad)} should be refused`);
    }
  });
});

describe("adding a slab", () => {
  it("accepts a complete one", () => {
    const r = validateStock(SLAB, NOW);
    assert.ok(r.ok, r.ok ? "" : r.reason);
    assert.equal(r.value.kind, "SLAB");
    if (r.value.kind !== "SLAB") return;
    assert.equal(r.value.costCents, 215_000);
    assert.equal(r.value.materialId, "mat_1");
    assert.equal(r.value.newMaterial, null);
  });

  it("takes a new material instead of an existing one", () => {
    const r = validateStock({ ...SLAB, materialId: "", ...MATERIAL }, NOW);
    assert.ok(r.ok, r.ok ? "" : r.reason);
    if (!r.ok || r.value.kind !== "SLAB") return;
    assert.equal(r.value.materialId, null);
    assert.equal(r.value.newMaterial?.costPerSqmCents, 48_000);
    assert.equal(r.value.newMaterial?.kind, "ENGINEERED");
  });

  it("refuses a piece with neither an existing material nor a complete new one", () => {
    const r = validateStock({ ...SLAB, materialId: "" }, NOW);
    assert.equal(r.ok, false);
  });

  it("refuses a made-up material kind", () => {
    const r = validateStock({ ...SLAB, materialId: "", ...MATERIAL, materialKind: "MARBLE" }, NOW);
    assert.equal(r.ok, false);
  });

  it("refuses a slab bigger than any slab", () => {
    assert.equal(validateStock({ ...SLAB, lengthMm: "42000" }, NOW).ok, false);
  });

  it("refuses fractional millimetres", () => {
    assert.equal(validateStock({ ...SLAB, widthMm: "1400.5" }, NOW).ok, false);
  });

  it("refuses stock that arrives in the future", () => {
    assert.equal(validateStock({ ...SLAB, arrivedAt: "2027-01-01" }, NOW).ok, false);
  });

  it("refuses a cost with an extra zero past the plausible", () => {
    assert.equal(validateStock({ ...SLAB, cost: "21500000" }, NOW).ok, false);
  });

  it("refuses a missing rack — stock nobody can find is not stock", () => {
    assert.equal(validateStock({ ...SLAB, rack: "  " }, NOW).ok, false);
  });
});

describe("adding an offcut", () => {
  it("accepts a complete one", () => {
    const r = validateStock(OFFCUT, NOW);
    assert.ok(r.ok, r.ok ? "" : r.reason);
    if (!r.ok || r.value.kind !== "OFFCUT") return;
    assert.equal(r.value.thicknessMm, 20);
    assert.equal(r.value.listedPublicly, false);
    assert.equal(r.value.parentSlabId, null);
  });

  it("carries the website flag and the parent slab through", () => {
    const r = validateStock(
      { ...OFFCUT, listedPublicly: true, parentSlabId: "slab_9", notes: "Chipped corner" },
      NOW,
    );
    assert.ok(r.ok);
    if (!r.ok || r.value.kind !== "OFFCUT") return;
    assert.equal(r.value.listedPublicly, true);
    assert.equal(r.value.parentSlabId, "slab_9");
    assert.equal(r.value.notes, "Chipped corner");
  });

  it("has no cost of its own to get wrong", () => {
    const r = validateStock({ ...OFFCUT, cost: "999999" }, NOW);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(!("costCents" in r.value), "an offcut must not carry a cost");
  });
});

describe("adding a consumable", () => {
  it("accepts a complete one", () => {
    const r = validateStock(CONSUMABLE, NOW);
    assert.ok(r.ok, r.ok ? "" : r.reason);
    if (!r.ok || r.value.kind !== "CONSUMABLE") return;
    assert.equal(r.value.qtyOnHand, 24);
    assert.equal(r.value.unitCostCents, 1250);
  });

  it("allows none on hand — you can track what you have run out of", () => {
    const r = validateStock({ ...CONSUMABLE, qtyOnHand: "0" }, NOW);
    assert.ok(r.ok);
  });

  it("refuses a negative count", () => {
    assert.equal(validateStock({ ...CONSUMABLE, qtyOnHand: "-1" }, NOW).ok, false);
  });

  it("needs no material or dimensions", () => {
    const r = validateStock(CONSUMABLE, NOW);
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.ok(!("widthMm" in r.value));
  });
});

describe("rubbish in", () => {
  it("refuses an unknown kind", () => {
    for (const bad of ["", "MATERIAL", "slab", undefined, 7]) {
      assert.equal(validateStock({ kind: bad }, NOW).ok, false);
    }
  });

  it("does not throw on anything at all", () => {
    for (const bad of [{}, { kind: {} }, { kind: "SLAB", widthMm: [] }]) {
      assert.doesNotThrow(() => validateStock(bad as Record<string, unknown>, NOW));
    }
  });
});

describe("references", () => {
  it("starts a series", () => {
    assert.equal(nextRef("SLB", []), "SLB-0001");
  });

  it("continues from the highest in use, not the count", () => {
    // The gap matters: with only two slabs on file, counting would hand out
    // SLB-0003 again and collide.
    assert.equal(nextRef("SLB", ["SLB-0001", "SLB-0003"]), "SLB-0004");
  });

  it("is not confused by another series or by junk", () => {
    assert.equal(nextRef("OFF", ["SLB-0900", "OFF-0007", "OFF-junk", ""]), "OFF-0008");
  });

  it("keeps going past four digits rather than wrapping", () => {
    assert.equal(nextRef("SLB", ["SLB-9999"]), "SLB-10000");
  });
});
