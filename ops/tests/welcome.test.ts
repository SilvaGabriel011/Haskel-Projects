/**
 * The first-login walkthrough: who is sent to it, and what it tells them.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { STAGES, requiresAdmin } from "../lib/pipeline";
import { STAGE_HELP, needsWelcome, stagesFor } from "../lib/welcome";

describe("who is sent to /welcome", () => {
  it("someone who has not finished it, once", () => {
    assert.equal(needsWelcome({ onboardedAt: null }), true);
    assert.equal(needsWelcome({ onboardedAt: new Date() }), false);
  });

  it("never someone arriving with ?denied, or the explanation is lost", () => {
    // An admin-only link bounces an employee to /dashboard?denied=... to say
    // why. Sending them on to /welcome would swallow that message.
    assert.equal(needsWelcome({ onboardedAt: null }, "/financials"), false);
  });
});

describe("what the walkthrough says about moving jobs", () => {
  it("lists all eleven stages, in order, each explained", () => {
    const stages = stagesFor("EMPLOYEE");
    assert.deepEqual(stages.map((s) => s.status), [...STAGES]);
    assert.deepEqual(stages.map((s) => s.number), STAGES.map((_, i) => i + 1));
    for (const s of stages) assert.ok(STAGE_HELP[s.status as keyof typeof STAGE_HELP], `${s.status} has no help text`);
  });

  it("never tells an installer they can make a move the server refuses", () => {
    for (const s of stagesFor("EMPLOYEE").slice(1)) {
      assert.equal(s.canMove, !requiresAdmin(s.status), `${s.status} disagrees with lib/pipeline`);
    }
  });

  it("tells an admin they can make every move", () => {
    assert.ok(stagesFor("ADMIN").every((s) => s.canMove));
  });
});
