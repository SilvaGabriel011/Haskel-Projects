import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { db } from "../lib/db";
import { zonedParts, zonedTime } from "../lib/business-time";
import { addDays, byDay, listWeek, visibleTo, weekStart } from "../lib/queries/schedule";

after(async () => { await db.$disconnect(); });

describe("an employee cannot widen their own view", () => {
  it("ignores someone else's id in the query string", () => {
    assert.equal(visibleTo("EMPLOYEE", "me", "someone-else"), "me");
  });

  it("ignores a blank filter too — it does not fall through to everyone", () => {
    assert.equal(visibleTo("EMPLOYEE", "me", ""), "me");
    assert.equal(visibleTo("EMPLOYEE", "me", undefined), "me");
  });

  it("an admin may look at one person, or everyone", () => {
    assert.equal(visibleTo("ADMIN", "boss", "someone-else"), "someone-else");
    assert.equal(visibleTo("ADMIN", "boss", ""), undefined);
    assert.equal(visibleTo("ADMIN", "boss", undefined), undefined);
  });
});

describe("weeks", () => {
  // Asserted through zonedParts, not getDay/getHours/getDate. Those read the
  // SERVER's clock, and a week starts on Monday midnight in the BUSINESS's
  // zone — in Adelaide that instant is Sunday 14:30 UTC, so the old assertions
  // only held while BUSINESS_TIMEZONE was unset. They passed by agreeing with
  // the bug rather than with the intent.
  // Fixtures are built with zonedTime, not a zoneless date string: `new
  // Date("2026-09-20T15:00:00")` means 3pm to the SERVER, which is already
  // half past midnight on Monday in Adelaide — the wrong week, and not what
  // the case is about.
  it("starts on Monday whatever day you ask from", () => {
    for (const day of [14, 17, 20]) {
      const p = zonedParts(weekStart(zonedTime(2026, 9, day, 9, 0)));
      assert.equal(p.weekday, 1, `the ${day}th should land on a Monday`);
      assert.equal(p.hour, 0, `the ${day}th should land on midnight`);
      assert.equal(p.minute, 0);
    }
  });

  it("a Sunday belongs to the week that just ended, not the one starting", () => {
    const sundayAfternoon = zonedTime(2026, 9, 20, 15, 0);
    assert.equal(zonedParts(weekStart(sundayAfternoon)).day, 14);
  });

  it("buckets events into seven days, Monday first", () => {
    const from = weekStart(zonedTime(2026, 9, 14));
    const events = [
      { startAt: new Date(from) },
      { startAt: addDays(from, 3) },
      { startAt: addDays(from, 3) },
      { startAt: addDays(from, 6) },
    ];
    const days = byDay(events, from);
    assert.equal(days.length, 7);
    assert.equal(days[0].length, 1);
    assert.equal(days[3].length, 2);
    assert.equal(days[6].length, 1);
  });

  it("drops anything outside the week rather than mis-filing it", () => {
    const from = weekStart(zonedTime(2026, 9, 14));
    const days = byDay([{ startAt: addDays(from, 9) }, { startAt: addDays(from, -2) }], from);
    assert.equal(days.flat().length, 0);
  });
});

describe("against the seeded data", () => {
  it("filtering by a person returns only their bookings", async () => {
    const person = await db.user.findFirst({ where: { role: "EMPLOYEE" }, select: { id: true } });
    assert.ok(person);
    const anyEvent = await db.scheduleEvent.findFirst({ select: { startAt: true }, orderBy: { startAt: "asc" } });
    assert.ok(anyEvent);

    const from = weekStart(anyEvent.startAt);
    const mine = await listWeek(from, person.id);
    for (const e of mine) {
      assert.ok(
        e.assignees.some((a) => a.user.id === person.id),
        "returned a booking that is not theirs",
      );
    }
  });
});
