/**
 * The stone catalogue and the dropdowns built from it: each list offers only
 * what the one before allows.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { MATERIAL_KINDS } from "../lib/stock-input";
import {
  ON_FILE_RANGE,
  STONE_CATALOGUE,
  catalogueKey,
  colourOptions,
  fromCatalogueKey,
  onFileFor,
  rangeOptions,
  sizeOptions,
} from "../lib/stone-catalogue";

const lunar = "cat:dekton:Lunar";
const onFile = [
  { id: "m1", name: "Dekton Lunar", kind: "SINTERED" as const, thicknessMm: 20, finish: "Matte" },
  { id: "m2", name: "Sintered Graphite", kind: "SINTERED" as const, thicknessMm: 20, finish: "Matte" },
];

describe("the catalogue", () => {
  it("has something for every type of stone", () => {
    for (const kind of MATERIAL_KINDS) {
      assert.ok(STONE_CATALOGUE.some((r) => r.kind === kind && r.colours.length > 0), kind);
    }
  });

  it("has no colour twice in a range, and every colour is made in something", () => {
    for (const r of STONE_CATALOGUE) {
      const names = r.colours.map((c) => c.name);
      assert.equal(new Set(names).size, names.length, r.id);
      for (const c of r.colours) {
        assert.ok((c.thicknesses ?? r.thicknesses).length > 0, `${r.id} ${c.name} thickness`);
        assert.ok((c.finishes ?? r.finishes).length > 0, `${r.id} ${c.name} finish`);
      }
    }
  });

  it("lists only silica-free engineered stone, as Australian law has since July 2024", () => {
    for (const r of STONE_CATALOGUE.filter((x) => x.kind === "ENGINEERED")) {
      assert.match(r.label, /silica-free/i);
    }
  });

  it("reads a colour back from its form value, and nothing from a made-up one", () => {
    const range = STONE_CATALOGUE.find((r) => r.id === "dekton")!;
    const key = catalogueKey(range, range.colours[0]);
    assert.equal(fromCatalogueKey(key)?.colour.name, range.colours[0].name);
    assert.equal(fromCatalogueKey("cat:dekton:Not A Colour"), null);
    assert.equal(fromCatalogueKey("cat:nobody:Lunar"), null);
    assert.equal(fromCatalogueKey("m1"), null);
  });
});

describe("the stone dropdowns", () => {
  it("offer the ranges of the chosen type, and nothing before a type", () => {
    assert.deepEqual(rangeOptions("", onFile), []);
    const natural = rangeOptions("NATURAL", []).map((r) => r.value);
    assert.deepEqual(natural, ["marble", "granite", "quartzite"]);
  });

  it("add “Other colours on file” only when one of that type is not in the catalogue", () => {
    assert.ok(rangeOptions("SINTERED", onFile).some((r) => r.value === ON_FILE_RANGE));
    assert.ok(!rangeOptions("SINTERED", [onFile[0]]).some((r) => r.value === ON_FILE_RANGE));
  });

  it("offer a colour on file once, as the material, so the job links to the stock", () => {
    const colours = colourOptions("SINTERED", "dekton", onFile);
    const lunars = colours.filter((c) => c.label.startsWith("Lunar"));
    assert.equal(lunars.length, 1);
    assert.equal(lunars[0].value, "m1");
    assert.deepEqual(
      colourOptions("SINTERED", ON_FILE_RANGE, onFile).map((c) => c.value),
      ["m2"],
    );
  });

  it("match a colour on file by its full name or its colour alone, whatever the capitals", () => {
    const range = STONE_CATALOGUE.find((r) => r.id === "dekton")!;
    const colour = range.colours.find((c) => c.name === "Lunar")!;
    for (const name of ["Dekton Lunar", "lunar", " LUNAR "]) {
      assert.ok(onFileFor({ range, colour }, [{ name, kind: "SINTERED" }]), name);
    }
    assert.equal(onFileFor({ range, colour }, [{ name: "Lunar", kind: "NATURAL" }]), undefined);
  });

  it("offer only the thicknesses and finishes a colour is made in, and start from one", () => {
    const s = sizeOptions(lunar, []);
    assert.deepEqual(s.thicknesses, [12, 20, 30]);
    assert.deepEqual(s.finishes, ["Matte"]);
    assert.equal(s.thicknessMm, "20");
    assert.equal(s.finish, "Matte");

    // Made in one thickness only: picked for you.
    const arctic = sizeOptions("cat:neolith:Arctic White", []);
    assert.deepEqual(arctic.thicknesses, [12]);
    assert.equal(arctic.thicknessMm, "12");

    const concrete = sizeOptions("cat:caesarstone-mineral:Rugged Concrete", []);
    assert.deepEqual(concrete.finishes, ["Rough"]);
  });

  it("start a colour on file from what it is recorded as", () => {
    const s = sizeOptions("m2", onFile);
    assert.equal(s.thicknessMm, "20");
    assert.equal(s.finish, "Matte");
    assert.ok(s.thicknesses.includes(30), "a colour the catalogue does not know gets the usual sizes");
  });

  it("offer nothing before a colour", () => {
    assert.deepEqual(sizeOptions("", onFile).thicknesses, []);
    assert.deepEqual(colourOptions("SINTERED", "", onFile), []);
  });
});
