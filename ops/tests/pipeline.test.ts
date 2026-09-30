import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  FINAL_STAGE,
  STAGES,
  STAGE_LABEL,
  canTransition,
  nextStage,
  phase,
  requiresAdmin,
  stageNumber,
} from "../lib/pipeline";

describe("the eleven stages", () => {
  it("are the ones the business runs, in order", () => {
    // Taken verbatim from the Tekton stage flow so the two line up. Renaming
    // one here would quietly break that, which is the whole reason they match.
    assert.deepEqual(STAGES, [
      "INITIAL",
      "QUOTE_REQUEST",
      "QUOTED",
      "ORDER_ACTIVE",
      "PURCHASE_ORDER",
      "MEASURED",
      "DETAILS",
      "FACTORY",
      "READY_FOR_DISPATCH",
      "INSTALLATION",
      "INVOICE",
    ]);
  });

  it("every job runs every one — there is no second flow", () => {
    assert.equal(STAGES.length, 11);
    assert.equal(FINAL_STAGE, "INVOICE");
  });

  it("numbers them from one, as the dots are numbered", () => {
    assert.equal(stageNumber("INITIAL"), 1);
    assert.equal(stageNumber("FACTORY"), 8);
    assert.equal(stageNumber("INVOICE"), 11);
    assert.equal(stageNumber("LOST"), null);
  });

  it("gives every stage a label that is not the raw enum", () => {
    for (const s of [...STAGES, "LOST" as const]) {
      assert.ok(STAGE_LABEL[s], `${s} has no label`);
      assert.ok(!STAGE_LABEL[s].includes("_"), `${s} shows a raw enum`);
    }
  });
});

describe("transitions", () => {
  it("moves forward one step", () => {
    assert.equal(canTransition("ORDER_ACTIVE", "PURCHASE_ORDER").ok, true);
    assert.equal(canTransition("FACTORY", "READY_FOR_DISPATCH").ok, true);
  });

  it("refuses a skipped step, and names the one expected", () => {
    const r = canTransition("QUOTED", "FACTORY");
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.reason : "", /Order Active/);
  });

  it("refuses going backwards", () => {
    assert.equal(canTransition("FACTORY", "MEASURED").ok, false);
  });

  it("allows LOST only before the order is active", () => {
    assert.equal(canTransition("INITIAL", "LOST").ok, true);
    assert.equal(canTransition("QUOTE_REQUEST", "LOST").ok, true);
    assert.equal(canTransition("QUOTED", "LOST").ok, true);
    // Once stone is being bought and cut, a job is not simply "lost".
    assert.equal(canTransition("PURCHASE_ORDER", "LOST").ok, false);
    assert.equal(canTransition("FACTORY", "LOST").ok, false);
  });

  it("will not move a finished or abandoned job", () => {
    assert.equal(canTransition("INVOICE", "INSTALLATION").ok, false);
    assert.equal(canTransition("LOST", "QUOTED").ok, false);
  });

  it("refuses a move to where it already is", () => {
    assert.equal(canTransition("FACTORY", "FACTORY").ok, false);
  });

  it("runs the whole flow end to end", () => {
    for (let i = 0; i < STAGES.length - 1; i++) {
      assert.equal(
        canTransition(STAGES[i], STAGES[i + 1]).ok,
        true,
        `${STAGES[i]} -> ${STAGES[i + 1]}`,
      );
    }
    assert.equal(nextStage(STAGES.at(-1)!), null);
  });
});

describe("phase — what the financials group by", () => {
  it("collapses the eleven onto four buckets", () => {
    assert.equal(phase("INITIAL"), "OPEN");
    assert.equal(phase("QUOTE_REQUEST"), "OPEN");
    assert.equal(phase("QUOTED"), "OPEN");
    // A job is won once the order is active: that is the point an order exists
    // rather than a quote someone may never accept.
    assert.equal(phase("ORDER_ACTIVE"), "WON");
    assert.equal(phase("FACTORY"), "WON");
    assert.equal(phase("INSTALLATION"), "WON");
    assert.equal(phase("INVOICE"), "COMPLETE");
    assert.equal(phase("LOST"), "LOST");
  });

  it("gives every stage a phase", () => {
    for (const s of [...STAGES, "LOST" as const]) assert.ok(phase(s));
  });

  it("moves from OPEN to WON exactly once, and never back", () => {
    const seen = STAGES.map(phase);
    assert.equal(seen.filter((p, i) => p === "WON" && seen[i - 1] === "OPEN").length, 1);
    assert.ok(!seen.slice(seen.indexOf("WON")).includes("OPEN"));
  });
});

describe("who may set which stage", () => {
  it("pricing, committing and invoicing stay with the office", () => {
    for (const s of ["QUOTED", "ORDER_ACTIVE", "PURCHASE_ORDER", "INVOICE", "LOST"] as const) {
      assert.equal(requiresAdmin(s), true, `${s} should be admin-only`);
    }
  });

  it("moving work along the bench is not", () => {
    for (const s of ["MEASURED", "DETAILS", "FACTORY", "READY_FOR_DISPATCH", "INSTALLATION"] as const) {
      assert.equal(requiresAdmin(s), false, `${s} should be open to an installer`);
    }
  });
});
