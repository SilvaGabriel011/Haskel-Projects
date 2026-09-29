/**
 * The stage timeline's arithmetic.
 *
 * These numbers are read off a screen and believed, so they are worth pinning
 * down: a wrong total or a share that does not add up undermines every other
 * figure on the page.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  OVER_3_DAYS_MS,
  OVER_5_DAYS_MS,
  buildTimeline,
  hoursOf,
  humanDuration,
  timeShares,
  toneForMs,
  type StageRow,
} from "../lib/stage-timing";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const T0 = new Date("2026-09-01T00:00:00Z");
const at = (h: number) => new Date(T0.getTime() + h * HOUR);

describe("durations as a person would say them", () => {
  it("uses minutes below an hour", () => {
    // Several of these stages are a click apart, and "0.0 days" tells nobody
    // anything.
    assert.equal(humanDuration(7 * 60_000), "7 min");
    assert.equal(humanDuration(0), "0 min");
  });

  it("uses hours below a day, then days", () => {
    assert.equal(humanDuration(3 * HOUR), "3 hours");
    assert.equal(humanDuration(1 * HOUR), "1 hour");
    assert.equal(humanDuration(28.8 * HOUR), "1.2 days");
  });

  it("gives hours to one decimal", () => {
    assert.equal(hoursOf(89.64 * HOUR), 89.6);
  });
});

describe("the traffic light", () => {
  it("turns amber at three days and red at five", () => {
    assert.equal(toneForMs(2 * DAY), "ok");
    assert.equal(toneForMs(OVER_3_DAYS_MS), "over3");
    assert.equal(toneForMs(4 * DAY), "over3");
    assert.equal(toneForMs(OVER_5_DAYS_MS), "over5");
  });

  it("marks the running stage as live whatever it has taken", () => {
    assert.equal(toneForMs(9 * DAY, true), "live");
  });
});

describe("a timeline", () => {
  const rows: StageRow[] = [
    { stage: "INITIAL", enteredAt: at(0), exitedAt: at(0.1), movedBy: { name: "Mitchell G." } },
    { stage: "QUOTE_REQUEST", enteredAt: at(0.1), exitedAt: at(28.7) },
    { stage: "QUOTED", enteredAt: at(28.7), exitedAt: at(118.3), movedBy: { name: "Andreia S." } },
    { stage: "ORDER_ACTIVE", enteredAt: at(118.3), exitedAt: null },
  ];
  const now = at(130);
  const t = buildTimeline(rows, now);

  it("totals the time across every spell", () => {
    assert.equal(t.totalHours, 130);
    assert.equal(t.totalDays, 5.4);
  });

  it("leaves the open spell running to now", () => {
    assert.equal(t.current?.stage, "ORDER_ACTIVE");
    assert.equal(t.current?.live, true);
    assert.equal(t.current?.hours, 11.7);
    assert.equal(t.current?.tone, "live");
  });

  it("counts only the spells that have ended as completed", () => {
    assert.equal(t.completed, 3);
    assert.equal(t.ofStages, 11);
  });

  it("names the longest stage, counting one still running", () => {
    // "It has been in Factory for six days" is the point, not a footnote.
    assert.equal(t.longest?.stage, "QUOTED");
    assert.equal(t.longest?.hours, 89.6);
  });

  it("lists every stage, including the ones not started", () => {
    assert.equal(t.all.length, 11);
    assert.equal(t.all.filter((a) => a.spell === null).length, 7);
    assert.equal(t.all[0].spell?.stage, "INITIAL");
  });

  it("carries who moved it, where that is known", () => {
    assert.equal(t.spells[0].movedBy, "Mitchell G.");
    assert.equal(t.spells[1].movedBy, null);
  });

  it("numbers the stages as the dots are numbered", () => {
    assert.equal(t.spells[0].number, 1);
    assert.equal(t.spells[3].number, 4);
  });
});

describe("where the time went", () => {
  const rows: StageRow[] = [
    { stage: "INITIAL", enteredAt: at(0), exitedAt: at(25) },
    { stage: "QUOTE_REQUEST", enteredAt: at(25), exitedAt: at(50) },
    { stage: "QUOTED", enteredAt: at(50), exitedAt: at(100) },
  ];
  const t = buildTimeline(rows, at(100));
  const shares = timeShares(t);

  it("splits the total into one band per spell", () => {
    assert.equal(shares.length, 3);
    assert.deepEqual(shares.map((s) => s.pct), [25, 25, 50]);
  });

  it("adds up to a hundred", () => {
    // Rounding each band before summing drifts by several points over eleven
    // stages, so the shares are computed raw and rounded once.
    const total = shares.reduce((a, s) => a + s.pct, 0);
    assert.ok(Math.abs(total - 100) < 0.5, `bands add to ${total}`);
  });

  it("leaves a sliver unlabelled rather than squeezing text into it", () => {
    const tiny = buildTimeline(
      [
        { stage: "INITIAL", enteredAt: at(0), exitedAt: at(0.2) },
        { stage: "QUOTE_REQUEST", enteredAt: at(0.2), exitedAt: at(100) },
      ],
      at(100),
    );
    const [first, second] = timeShares(tiny);
    assert.equal(first.showLabel, false);
    assert.equal(second.showLabel, true);
  });

  it("returns nothing at all rather than dividing by zero", () => {
    const empty = buildTimeline([], at(0));
    assert.deepEqual(timeShares(empty), []);
    assert.equal(empty.totalMs, 0);
    assert.equal(empty.current, null);
  });
});
