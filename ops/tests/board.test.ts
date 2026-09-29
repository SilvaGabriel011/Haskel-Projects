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
    status: "WON",
    address: "12 Rose St",
    suburb: "Prospect",
    quoteCents: 210_000,
    lineCount: 1,
    customer: { ...COMPLETE_CUSTOMER },
    createdAt: daysBefore(20),
    wonAt: daysBefore(1),
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
  it("is measured per stage, not one number for everything", () => {
    // Six days is fine for fabrication and well past it for an enquiry. A
    // single threshold would either nag about fabrication or miss dead leads.
    assert.equal(ageTone("FABRICATING", 6), "ok");
    assert.equal(ageTone("ENQUIRY", 6), "late");
  });

  it("goes amber then red as the days pass", () => {
    assert.equal(ageTone("ENQUIRY", 1), "ok");
    assert.equal(ageTone("ENQUIRY", 2), "warn");
    assert.equal(ageTone("ENQUIRY", 4), "late");
  });

  it("never chases finished or abandoned work", () => {
    assert.equal(ageTone("COMPLETE", 900), "ok");
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
    const gaps = gapsFor(job({ status: "ENQUIRY", address: "", lineCount: 0, quoteCents: 0 }));
    assert.equal(gaps.find((g) => g.field === "address")?.blocking, false);
    assert.ok(!gaps.some((g) => g.field === "lines"));
    assert.ok(!gaps.some((g) => g.field === "quote"));
  });

  it("does want a cut list once the job is won", () => {
    const gaps = gapsFor(job({ status: "WON", lineCount: 0 }));
    assert.equal(gaps.find((g) => g.field === "lines")?.blocking, true);
  });

  it("stays quiet on finished and abandoned jobs", () => {
    assert.deepEqual(gapsFor(job({ status: "COMPLETE", address: "", customer: { name: null, phone: null, email: null } })), []);
    assert.deepEqual(gapsFor(job({ status: "LOST", address: "" })), []);
  });

  it("never raises a money gap for an employee", () => {
    // quoteCents absent means it was never read, which is not the same as
    // zero. An employee must not be shown a gap they cannot see or fix.
    const asEmployee = job({ status: "WON" });
    delete asEmployee.quoteCents;
    assert.ok(!gapsFor(asEmployee).some((g) => g.field === "quote"));

    const asAdmin = job({ status: "WON", quoteCents: 0 });
    assert.ok(gapsFor(asAdmin).some((g) => g.field === "quote"));
  });
});

describe("when the job last moved", () => {
  it("counts from when it was won, once it has been", () => {
    const j = job({ status: "CUTTING", createdAt: daysBefore(30), wonAt: daysBefore(3) });
    assert.equal(stageSince(j).getTime(), daysBefore(3).getTime());
  });

  it("counts from when it arrived, before that", () => {
    const j = job({ status: "ENQUIRY", createdAt: daysBefore(30), wonAt: null });
    assert.equal(stageSince(j).getTime(), daysBefore(30).getTime());
  });

  it("falls back to creation when a won job somehow has no wonAt", () => {
    const j = job({ status: "WON", createdAt: daysBefore(9), wonAt: null });
    assert.equal(stageSince(j).getTime(), daysBefore(9).getTime());
  });
});

describe("a card", () => {
  it("is green when it is moving and complete", () => {
    const c = toCard(job({ status: "WON", wonAt: daysBefore(1) }), NOW);
    assert.equal(c.tone, "ok");
    assert.equal(c.daysInStage, 1);
    assert.equal(c.datePassed, false);
  });

  it("takes the worse of age and missing detail", () => {
    // Fresh, so the age is fine; but no phone number, which is blocking.
    const c = toCard(
      job({ wonAt: daysBefore(1), customer: { ...COMPLETE_CUSTOMER, phone: "" } }),
      NOW,
    );
    assert.equal(c.ageTone, "ok");
    assert.equal(c.gapTone, "late");
    assert.equal(c.tone, "late");
  });

  it("goes red when a booked date has come and gone", () => {
    const c = toCard(job({ status: "SCHEDULED", pipeline: "FULL", wonAt: daysBefore(2), nextEventAt: daysBefore(3) }), NOW);
    assert.equal(c.datePassed, true);
    assert.equal(c.tone, "late");
  });

  it("does not flag a booking that is still ahead", () => {
    const ahead = zonedTime(2026, 10, 6, 9, 0);
    const c = toCard(job({ status: "SCHEDULED", pipeline: "FULL", wonAt: daysBefore(1), nextEventAt: ahead }), NOW);
    assert.equal(c.datePassed, false);
  });

  it("never counts negative days from a date in the future", () => {
    const c = toCard(job({ createdAt: zonedTime(2026, 10, 20), wonAt: null, status: "ENQUIRY" }), NOW);
    assert.equal(c.daysInStage, 0);
  });
});

describe("filters", () => {
  const cards = [
    toCard(job({ id: "a", wonAt: daysBefore(1) }), NOW), // ok
    toCard(job({ id: "b", customer: { ...COMPLETE_CUSTOMER, email: null }, wonAt: daysBefore(1) }), NOW), // warn, missing
    toCard(job({ id: "c", status: "ENQUIRY", wonAt: null, createdAt: daysBefore(9) }), NOW), // late by age
    toCard(job({ id: "d", status: "SCHEDULED", pipeline: "FULL", wonAt: daysBefore(1), nextEventAt: daysBefore(2) }), NOW), // date passed
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
  it("never shows a column the board excludes", () => {
    // COMPLETE and LOST are filtered out at the query, so a column for either
    // would always read zero.
    assert.ok(!BOARD_STAGES.includes("COMPLETE"));
    assert.ok(!BOARD_STAGES.includes("LOST"));
  });

  it("puts cutting straight after won, not last", () => {
    // Concatenating the two pipelines' stage lists put CUTTING — the short
    // pipeline's only post-win stage — after INSTALLED, reading as though
    // offcut jobs are cut at the very end.
    const all = columnsFor();
    assert.ok(all.indexOf("CUTTING") === all.indexOf("WON") + 1);
    assert.ok(all.indexOf("CUTTING") < all.indexOf("INSTALLED"));
  });

  it("narrows to one pipeline's own stages", () => {
    assert.deepEqual(columnsFor("SHORT"), ["ENQUIRY", "QUOTED", "WON", "CUTTING"]);
    assert.deepEqual(columnsFor("FULL"), [
      "ENQUIRY", "QUOTED", "WON", "TEMPLATED", "FABRICATING", "SCHEDULED", "INSTALLED",
    ]);
  });

  it("every stage a card can be in has a column", () => {
    // Otherwise a job silently vanishes from the board rather than showing up
    // somewhere wrong, which is worse.
    for (const p of ["SHORT", "FULL"] as const) {
      for (const s of STAGES[p]) {
        if (s === "COMPLETE") continue;
        assert.ok(columnsFor(p).includes(s), `${p}/${s} has no column`);
      }
    }
  });
});
