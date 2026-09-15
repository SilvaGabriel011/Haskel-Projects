import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canTransition, nextStage, phase, STAGES } from "../lib/pipeline";

describe("pipeline stages", () => {
  it("short pipeline skips the template and fabricate steps", () => {
    assert.deepEqual(STAGES.SHORT, ["ENQUIRY", "QUOTED", "WON", "CUTTING", "COMPLETE"]);
    assert.ok(!STAGES.SHORT.includes("TEMPLATED"));
    assert.ok(!STAGES.SHORT.includes("FABRICATING"));
  });

  it("full pipeline keeps them", () => {
    assert.ok(STAGES.FULL.includes("TEMPLATED"));
    assert.ok(STAGES.FULL.includes("FABRICATING"));
  });
});

describe("transitions", () => {
  it("moves forward one step", () => {
    assert.equal(canTransition("SHORT", "WON", "CUTTING").ok, true);
    assert.equal(canTransition("FULL", "WON", "TEMPLATED").ok, true);
  });

  it("refuses a stage from the other pipeline, and says so", () => {
    const r = canTransition("SHORT", "WON", "TEMPLATED");
    assert.equal(r.ok, false);
    assert.match(r.ok === false ? r.reason : "", /full pipeline/i);
  });

  it("refuses a skipped step", () => {
    assert.equal(canTransition("FULL", "WON", "INSTALLED").ok, false);
  });

  it("refuses going backwards", () => {
    assert.equal(canTransition("SHORT", "CUTTING", "WON").ok, false);
  });

  it("allows LOST only before a job is won", () => {
    assert.equal(canTransition("SHORT", "QUOTED", "LOST").ok, true);
    assert.equal(canTransition("SHORT", "CUTTING", "LOST").ok, false);
  });

  it("will not move a finished job", () => {
    assert.equal(canTransition("SHORT", "COMPLETE", "CUTTING").ok, false);
    assert.equal(canTransition("SHORT", "LOST", "QUOTED").ok, false);
  });

  it("runs each pipeline end to end", () => {
    for (const p of ["SHORT", "FULL"] as const) {
      const stages = STAGES[p];
      for (let i = 0; i < stages.length - 1; i++) {
        assert.equal(canTransition(p, stages[i], stages[i + 1]).ok, true,
          `${p}: ${stages[i]} -> ${stages[i + 1]}`);
      }
      assert.equal(nextStage(p, stages.at(-1)!), null);
    }
  });
});

describe("phase — what makes two pipelines reportable as one", () => {
  it("collapses both pipelines onto the same four buckets", () => {
    assert.equal(phase("ENQUIRY"), "OPEN");
    assert.equal(phase("QUOTED"), "OPEN");
    assert.equal(phase("CUTTING"), "WON");      // short
    assert.equal(phase("FABRICATING"), "WON");  // full
    assert.equal(phase("COMPLETE"), "COMPLETE");
    assert.equal(phase("LOST"), "LOST");
  });

  it("gives every status in both pipelines a phase", () => {
    for (const p of ["SHORT", "FULL"] as const) {
      for (const s of STAGES[p]) assert.ok(phase(s));
    }
  });
});
