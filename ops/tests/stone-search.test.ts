/**
 * Finding a stone by typing on New job, and the stones offered before
 * anything is typed: the ones chosen most recently and most often.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isNewStoneKey, newStoneKey, newStoneName } from "../lib/stone";
import { sizeOptions } from "../lib/stone-catalogue";
import { allStoneChoices, canAddStone, chosenStones, searchStones } from "../lib/stone-search";

const onFile = [
  { id: "m-kreta", name: "Dekton Kreta", kind: "SINTERED" as const, thicknessMm: 20, finish: "Matte" },
  { id: "m-local", name: "Local Bluestone", kind: "NATURAL" as const, thicknessMm: 30, finish: "Honed" },
];
const choices = allStoneChoices(onFile);
const names = (cs: { name: string }[]) => cs.map((c) => c.name);
const day = (d: number) => new Date(Date.UTC(2026, 9, d));

describe("every stone the search knows", () => {
  it("covers the catalogue, with a colour on file offered once, as that material", () => {
    assert.ok(choices.some((c) => c.value === "cat:dekton:Lunar" && c.name === "Dekton Lunar"));
    const kreta = choices.filter((c) => c.name === "Dekton Kreta");
    assert.equal(kreta.length, 1, "on file and in the catalogue, but offered once");
    assert.equal(kreta[0].value, "m-kreta");
    assert.ok(kreta[0].onFile);
  });

  it("includes stone on file that no catalogue lists, under its own type", () => {
    const local = choices.find((c) => c.value === "m-local");
    assert.ok(local);
    assert.equal(local.kind, "NATURAL");
    assert.equal(local.rangeId, "file", "picking it sets the brand dropdown to Other colours on file");
  });

  it("has no repeats", () => {
    assert.equal(new Set(choices.map((c) => c.value)).size, choices.length);
  });
});

describe("searching by typing", () => {
  it("finds a colour by its name alone, with or without the brand, in any order", () => {
    assert.equal(searchStones(choices, "lunar")[0].name, "Dekton Lunar");
    assert.equal(searchStones(choices, "dekton lunar")[0].name, "Dekton Lunar");
    assert.equal(searchStones(choices, "LUNAR dek")[0].name, "Dekton Lunar");
  });

  it("puts a name that starts with what was typed first", () => {
    const found = names(searchStones(choices, "calacatta", 50));
    assert.ok(found.length > 1);
    const first = found.findIndex((n) => !/^(\S+ )?calacatta/i.test(n));
    assert.ok(first === -1 || found.slice(first).every((n) => !/^(\S+ )?calacatta/i.test(n)), found.join(", "));
  });

  it("finds by brand and by type of stone", () => {
    assert.ok(searchStones(choices, "neolith", 50).every((c) => c.name.startsWith("Neolith")));
    assert.ok(searchStones(choices, "marble").length > 0);
  });

  it("ignores accents and spacing, and returns nothing for nothing typed", () => {
    assert.deepEqual(names(searchStones(choices, "  lunar ")), names(searchStones(choices, "lúnar")));
    assert.deepEqual(searchStones(choices, "   "), []);
  });

  it("stops at the limit", () => {
    assert.equal(searchStones(choices, "a", 8).length, 8);
  });
});

describe("adding a stone that is not listed", () => {
  it("is offered for a new name, and not for one already on the list", () => {
    assert.ok(canAddStone(choices, "Blue Bahia"));
    assert.ok(!canAddStone(choices, "dekton lunar"), "already listed");
    assert.ok(!canAddStone(choices, "Lunar"), "the colour without its brand is listed too");
    assert.ok(!canAddStone(choices, "x"), "too short to be a name");
    assert.ok(!canAddStone(choices, "x".repeat(81)), "too long");
  });

  it("carries its name in the form value, tidied", () => {
    const key = newStoneKey("  Blue   Bahia ");
    assert.equal(key, "new:Blue Bahia");
    assert.ok(isNewStoneKey(key));
    assert.equal(newStoneName(key), "Blue Bahia");
    assert.equal(newStoneName("new: "), "");
    assert.equal(newStoneName("m-kreta"), "");
  });

  it("can be any of the usual thicknesses and finishes, starting at 20 mm", () => {
    const s = sizeOptions("new:Blue Bahia", []);
    assert.deepEqual(s.thicknesses, [6, 8, 12, 13, 20, 30, 40]);
    assert.ok(s.finishes.includes("Honed") && s.finishes.includes("Leathered"));
    assert.equal(s.thicknessMm, "20");
    assert.deepEqual(sizeOptions("new: ", []).thicknesses, []);
  });
});

describe("recently and most chosen", () => {
  const lines = [
    { materialId: "m-kreta", description: "Dekton Kreta · 20 mm · Matte", at: day(1) },
    { materialId: null, description: "Dekton Lunar · 20 mm · Matte", at: day(2) },
    { materialId: "m-kreta", description: "Dekton Kreta · 30 mm · Matte", at: day(3) },
    { materialId: null, description: "Blue Bahia · 25 mm · Brushed", at: day(4) },
    { materialId: null, description: "Dekton Lunar · 12 mm · Matte", at: day(5) },
    { materialId: null, description: "Dekton Lunar · 30 mm · Matte", at: day(6) },
    // The seed's own wording, with no " · ": not a stone name to offer.
    { materialId: null, description: "Granite, cut and polished", at: day(7) },
  ];
  const { recent, most } = chosenStones(lines, choices);

  it("lists the latest first, each stone once", () => {
    assert.deepEqual(names(recent), ["Dekton Lunar", "Blue Bahia", "Dekton Kreta"]);
  });

  it("matches a catalogue colour named on a job back to the list, so it is picked as one", () => {
    assert.equal(recent[0].value, "cat:dekton:Lunar");
  });

  it("offers a stone typed in on an earlier job as it was typed", () => {
    assert.equal(recent[1].value, "new:Blue Bahia");
    assert.equal(recent[1].kind, null);
  });

  it("ranks by how often, leaving out stones picked only once", () => {
    assert.deepEqual(
      most.map((c) => [c.name, c.count]),
      [
        ["Dekton Lunar", 3],
        ["Dekton Kreta", 2],
      ],
    );
  });

  it("breaks a tie in favour of the one picked more recently", () => {
    const tied = chosenStones(
      [
        { materialId: "m-kreta", description: "", at: day(1) },
        { materialId: "m-kreta", description: "", at: day(2) },
        { materialId: "m-local", description: "", at: day(3) },
        { materialId: "m-local", description: "", at: day(4) },
      ],
      choices,
    );
    assert.deepEqual(names(tied.most), ["Local Bluestone", "Dekton Kreta"]);
  });

  it("skips a material no longer on file, and stops at the limit", () => {
    assert.deepEqual(chosenStones([{ materialId: "gone", description: "", at: day(1) }], choices).recent, []);
    const many = Array.from({ length: 9 }, (_, i) => ({
      materialId: null,
      description: `Stone ${i + 1} · 20 mm · Honed`,
      at: day(i + 1),
    }));
    assert.equal(chosenStones(many, choices).recent.length, 5);
  });
});
