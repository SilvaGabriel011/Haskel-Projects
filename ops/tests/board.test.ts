/**
 * The follow-up board's rules.
 *
 * These are judgement calls rendered as numbers — how long is too long, what
 * counts as a blocking gap — so they are worth pinning down where they can be
 * read and argued with, rather than left implicit in a component.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  ageTone,
  columnsFor,
  BOARD_STAGES,
  filterCounts,
  gapTone,
  gapsFor,
  matchesFilter,
  stageSince,
  toCard,
  worst,
  type JobForBoard,
} from "../lib/board";
import { zonedTime } from "../lib/business-time";
import { STAGES } from "../lib/pipeline";

const NOW = zonedTime(2026, 9, 29, 9, 0);
const daysBefore = (n: number) => zonedTime(2026, 9, 29 - n, 9, 0);

const COMPLETE_CUSTOMER = { name: "Sarah Nguyen", phone: "0412 345 678", email: "s@example.com" };

function job(over: Partial<JobForBoard> = {}): JobForBoard {
  return {
    id: "o1",
    jobNumber: "HP-2609-001",
    pipeline: "SHORT",
    status: "ORDER_ACTIVE",
    address: "12 Rose St",
    suburb: "Prospect",
    quoteCents: 210_000,
    lineCount: 1,
    customer: { ...COMPLETE_CUSTOMER },
    createdAt: daysBefore(20),
    wonAt: daysBefore(1),
    stageEnteredAt: daysBefore(1),
    completedAt: null,
    nextEventAt: null,
    ...over,
  };
}

describe("the worst signal wins", () => {
  it("takes the most severe of several", () => {
    assert.equal(worst("ok", "warn", "late"), "late");
    assert.equal(worst("ok", "warn"), "warn");
    assert.equal(worst("ok", "ok"), "ok");
    assert.equal(worst(), "ok");
  });
});

describe("how long is too long", () => {
  it("is the same three and five days for every stage", () => {
    // One pair of numbers everyone knows, matching the timeline legend, rather
    // than a per-stage table nobody remembers.
    for (const stage of ["INITIAL", "FACTORY", "INSTALLATION"] as const) {
      assert.equal(ageTone(stage, 2), "ok", stage);
      assert.equal(ageTone(stage, 3), "warn", stage);
      assert.equal(ageTone(stage, 4), "warn", stage);
      assert.equal(ageTone(stage, 5), "late", stage);
    }
  });

  it("never chases finished or abandoned work", () => {
    assert.equal(ageTone("INVOICE", 900), "ok");
    assert.equal(ageTone("LOST", 900), "ok");
  });
});

describe("what the office is missing", () => {
  it("says nothing when the record is complete", () => {
    assert.deepEqual(gapsFor(job()), []);
    assert.equal(gapTone([]), "ok");
  });

  it("treats no phone number as blocking — the customer cannot be reached", () => {
    const gaps = gapsFor(job({ customer: { ...COMPLETE_CUSTOMER, phone: "  " } }));
    assert.deepEqual(gaps.map((g) => g.field), ["phone"]);
    assert.equal(gaps[0].blocking, true);
    assert.equal(gapTone(gaps), "late");
  });

  it("treats a missing email as worth filling in, not worth stopping for", () => {
    const gaps = gapsFor(job({ customer: { ...COMPLETE_CUSTOMER, email: null } }));
    assert.equal(gaps[0].blocking, false);
    assert.equal(gapTone(gaps), "warn");
  });

  it("sees through the placeholder acceptBooking writes", () => {
    // A won job whose address is still "To confirm on the call" looks filled
    // in — it is a real string in a required column — but nobody knows where
    // to drive. This is the case the whole check exists for.
    const gaps = gapsFor(job({ address: "To confirm on the call" }));
    assert.deepEqual(gaps.map((g) => g.field), ["address"]);
    assert.equal(gaps[0].blocking, true);
  });

  it("catches the other stand-ins people type", () => {
    for (const v of ["TBC", "n/a", "N/A", "unknown", "---", ""]) {
      const gaps = gapsFor(job({ address: v }));
      assert.ok(gaps.some((g) => g.field === "address"), `${JSON.stringify(v)} should count as blank`);
    }
  });

  it("does not nag a fresh enquiry for what it cannot have yet", () => {
    // No address and no cut list is normal before a job is won. Flagging it
    // would make the board cry wolf, and a board that cries wolf is ignored.
    const gaps = gapsFor(job({ status: "INITIAL", address: "", lineCount: 0, quoteCents: 0 }));
    assert.equal(gaps.find((g) => g.field === "address")?.blocking, false);
    assert.ok(!gaps.some((g) => g.field === "lines"));
    assert.ok(!gaps.some((g) => g.field === "quote"));
  });

  it("wants a cut list from the measure onward, not the moment the order opens", () => {
    // A job that has just gone active has not been measured yet, so having
    // nothing on the cut list is normal. Once someone has been out to measure
    // it, an empty cut list stops the work.
    assert.ok(!gapsFor(job({ status: "ORDER_ACTIVE", lineCount: 0 })).some((g) => g.field === "lines"));
    for (const stage of ["MEASURED", "DETAILS", "FACTORY", "INSTALLATION"] as const) {
      const gaps = gapsFor(job({ status: stage, lineCount: 0 }));
      assert.equal(gaps.find((g) => g.field === "lines")?.blocking, true, stage);
    }
  });

  it("stays quiet on finished and abandoned jobs", () => {
    assert.deepEqual(gapsFor(job({ status: "INVOICE", address: "", customer: { name: null, phone: null, email: null } })), []);
    assert.deepEqual(gapsFor(job({ status: "LOST", address: "" })), []);
  });

  it("never raises a money gap for an employee", () => {
    // quoteCents absent means it was never read, which is not the same as
    // zero. An employee must not be shown a gap they cannot see or fix.
    const asEmployee = job({ status: "ORDER_ACTIVE" });
    delete asEmployee.quoteCents;
    assert.ok(!gapsFor(asEmployee).some((g) => g.field === "quote"));

    const asAdmin = job({ status: "ORDER_ACTIVE", quoteCents: 0 });
    assert.ok(gapsFor(asAdmin).some((g) => g.field === "quote"));
  });
});

describe("when the job last moved", () => {
  it("reads the stage history, which is the record", () => {
    const j = job({ createdAt: daysBefore(30), stageEnteredAt: daysBefore(3) });
    assert.equal(stageSince(j).getTime(), daysBefore(3).getTime());
  });

  it("falls back to creation for a job written before the history existed", () => {
    // Wrong, but never wildly so, and it stops a card vanishing from the board
    // because its history is missing.
    const j = job({ createdAt: daysBefore(9), stageEnteredAt: null });
    assert.equal(stageSince(j).getTime(), daysBefore(9).getTime());
  });
});

describe("a card", () => {
  it("is green when it is moving and complete", () => {
    const c = toCard(job({ status: "ORDER_ACTIVE", stageEnteredAt: daysBefore(1) }), NOW);
    assert.equal(c.tone, "ok");
    assert.equal(c.daysInStage, 1);
    assert.equal(c.datePassed, false);
  });

  it("takes the worse of age and missing detail", () => {
    // Fresh, so the age is fine; but no phone number, which is blocking.
    const c = toCard(
      job({ stageEnteredAt: daysBefore(1), customer: { ...COMPLETE_CUSTOMER, phone: "" } }),
      NOW,
    );
    assert.equal(c.ageTone, "ok");
    assert.equal(c.gapTone, "late");
    assert.equal(c.tone, "late");
  });

  it("goes red when a booked date has come and gone", () => {
    const c = toCard(job({ status: "INSTALLATION", stageEnteredAt: daysBefore(2), nextEventAt: daysBefore(3) }), NOW);
    assert.equal(c.datePassed, true);
    assert.equal(c.tone, "late");
  });

  it("does not flag a booking that is still ahead", () => {
    const ahead = zonedTime(2026, 10, 6, 9, 0);
    const c = toCard(job({ status: "INSTALLATION", stageEnteredAt: daysBefore(1), nextEventAt: ahead }), NOW);
    assert.equal(c.datePassed, false);
  });

  it("never counts negative days from a date in the future", () => {
    const c = toCard(job({ stageEnteredAt: zonedTime(2026, 10, 20), status: "INITIAL" }), NOW);
    assert.equal(c.daysInStage, 0);
  });
});

describe("filters", () => {
  const cards = [
    toCard(job({ id: "a", stageEnteredAt: daysBefore(1) }), NOW), // ok
    toCard(job({ id: "b", customer: { ...COMPLETE_CUSTOMER, email: null }, stageEnteredAt: daysBefore(1) }), NOW), // warn, missing
    toCard(job({ id: "c", status: "INITIAL", stageEnteredAt: daysBefore(9) }), NOW), // late by age
    toCard(job({ id: "d", status: "INSTALLATION", stageEnteredAt: daysBefore(1), nextEventAt: daysBefore(2) }), NOW), // date passed
  ];

  it("shows everything, or only what needs a look", () => {
    assert.equal(cards.filter((c) => matchesFilter(c, "all")).length, 4);
    assert.equal(cards.filter((c) => matchesFilter(c, "attention")).length, 3);
  });

  it("separates overdue from merely incomplete", () => {
    assert.deepEqual(cards.filter((c) => matchesFilter(c, "late")).map((c) => c.id), ["c", "d"]);
    assert.deepEqual(cards.filter((c) => matchesFilter(c, "missing")).map((c) => c.id), ["b"]);
    assert.deepEqual(cards.filter((c) => matchesFilter(c, "passed")).map((c) => c.id), ["d"]);
  });

  it("counts every filter for the chips", () => {
    const counts = filterCounts(cards);
    assert.equal(counts.all, 4);
    assert.equal(counts.attention, 3);
    assert.equal(counts.late, 2);
  });
});

describe("columns", () => {
  it("never shows a column that could only read zero", () => {
    // A job at INVOICE is finished and LOST is not a stage; both are excluded
    // at the query, so a column for either would always be empty.
    assert.ok(!BOARD_STAGES.includes("INVOICE"));
    assert.ok(!BOARD_STAGES.includes("LOST"));
  });

  it("keeps the stages in the order work progresses", () => {
    assert.deepEqual(columnsFor(), STAGES.filter((s) => s !== "INVOICE"));
  });

  it("every stage a card can be in has a column", () => {
    // Otherwise a job silently vanishes from the board rather than showing up
    // somewhere wrong, which is worse.
    for (const s of STAGES) {
      if (s === "INVOICE") continue;
      assert.ok(columnsFor().includes(s), `${s} has no column`);
    }
  });
});
