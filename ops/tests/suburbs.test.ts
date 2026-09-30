/**
 * Placing a suburb.
 *
 * The normalisation is the part that decides whether this feature appears to
 * work on real data: these fields are typed by hand into a booking form, so
 * "Prospect, SA 5082" has to reach the same place as "prospect".
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  SUBURBS,
  distanceKm,
  normaliseSuburb,
  suburbDistanceKm,
  suburbPoint,
} from "../lib/suburbs";

describe("reading a suburb someone typed", () => {
  it("takes the canonical spelling as it is", () => {
    assert.equal(normaliseSuburb("Prospect"), "Prospect");
  });

  it("does not care about case or stray whitespace", () => {
    for (const raw of ["prospect", "PROSPECT", "  Prospect  ", "Prospect\n"]) {
      assert.equal(normaliseSuburb(raw), "Prospect", JSON.stringify(raw));
    }
  });

  it("strips the state and postcode people tack on", () => {
    for (const raw of [
      "Prospect SA",
      "Prospect, SA",
      "Prospect SA 5082",
      "Prospect, SA 5082",
      "Prospect 5082",
      "prospect s.a.",
      "Prospect, South Australia",
    ]) {
      assert.equal(normaliseSuburb(raw), "Prospect", JSON.stringify(raw));
    }
  });

  it("handles two-word suburbs", () => {
    assert.equal(normaliseSuburb("henley beach"), "Henley Beach");
    assert.equal(normaliseSuburb("Mawson  Lakes, SA"), "Mawson Lakes");
    assert.equal(normaliseSuburb("golden grove sa 5125"), "Golden Grove");
  });

  it("returns null for anything it does not know, without throwing", () => {
    // Null is an ordinary answer: the job still shows everywhere else, it just
    // never groups.
    for (const raw of ["", "   ", "Nowhereville", "Sydney", null, undefined, 42, {}, []]) {
      assert.equal(normaliseSuburb(raw), null, JSON.stringify(raw));
    }
  });

  it("does not turn a postcode alone into a suburb", () => {
    assert.equal(normaliseSuburb("5082"), null);
  });

  it("does not eat a suburb whose own name starts with those letters", () => {
    // The state-stripping pattern needs a separator in front, so Salisbury and
    // Seaton survive it intact.
    assert.equal(normaliseSuburb("Salisbury"), "Salisbury");
    assert.equal(normaliseSuburb("Seaton"), "Seaton");
    assert.equal(normaliseSuburb("Salisbury SA 5108"), "Salisbury");
  });
});

describe("the gazetteer itself", () => {
  it("has no duplicate names", () => {
    const names = SUBURBS.map((s) => s.name.toLowerCase());
    assert.equal(new Set(names).size, names.length, "a suburb is listed twice");
  });

  it("puts every suburb in South Australia", () => {
    // A transposed sign or a swapped lat/lng would put a job in the North Sea
    // and quietly stop it grouping with its neighbours.
    for (const s of SUBURBS) {
      assert.ok(s.lat < -34 && s.lat > -36, `${s.name} latitude ${s.lat} is not Adelaide`);
      assert.ok(s.lng > 138 && s.lng < 139.5, `${s.name} longitude ${s.lng} is not Adelaide`);
    }
  });

  it("covers every suburb the demo data uses", () => {
    // The seed's suburbs must all place, or the demo shows the feature doing
    // nothing.
    const seeded = [
      "Prospect", "Norwood", "Glenelg", "Unley", "Henley Beach", "Burnside",
      "Modbury", "Mawson Lakes", "Brighton", "Magill", "Woodville", "Aldinga",
      "Semaphore", "Mitcham", "Golden Grove",
    ];
    for (const name of seeded) {
      assert.ok(suburbPoint(name), `${name} is in the seed but not the gazetteer`);
    }
  });
});

describe("distance", () => {
  const near = (a: string, b: string) => suburbDistanceKm(a, b)!;

  it("is zero from a place to itself", () => {
    assert.equal(near("Prospect", "Prospect"), 0);
  });

  it("is symmetric", () => {
    assert.equal(near("Glenelg", "Brighton"), near("Brighton", "Glenelg"));
  });

  it("puts neighbouring suburbs within a few kilometres", () => {
    // Glenelg to Brighton is a short run down the coast.
    assert.ok(near("Glenelg", "Brighton") < 5, `got ${near("Glenelg", "Brighton")}km`);
    assert.ok(near("Prospect", "Nailsworth") < 2, `got ${near("Prospect", "Nailsworth")}km`);
  });

  it("puts opposite corners of the city far apart", () => {
    assert.ok(near("Glenelg", "Modbury") > 15, `got ${near("Glenelg", "Modbury")}km`);
    assert.ok(near("Semaphore", "Mount Barker") > 35, `got ${near("Semaphore", "Mount Barker")}km`);
  });

  it("is null when either end cannot be placed", () => {
    assert.equal(suburbDistanceKm("Prospect", "Nowhereville"), null);
    assert.equal(suburbDistanceKm("Nowhereville", "Prospect"), null);
    assert.equal(suburbDistanceKm(null, "Prospect"), null);
  });

  it("measures over the curve, not flat degrees", () => {
    // A degree of longitude is about 18% shorter than a degree of latitude at
    // Adelaide. Treating them as equal reads east-west gaps as too wide.
    const oneDegreeNorth = distanceKm({ name: "a", lat: -34, lng: 138 }, { name: "b", lat: -35, lng: 138 });
    const oneDegreeEast = distanceKm({ name: "a", lat: -34, lng: 138 }, { name: "b", lat: -34, lng: 139 });
    assert.ok(oneDegreeEast < oneDegreeNorth, "longitude should compress at this latitude");
    assert.ok(Math.abs(oneDegreeNorth - 111) < 2, `a degree of latitude is ~111km, got ${oneDegreeNorth}`);
  });
});
