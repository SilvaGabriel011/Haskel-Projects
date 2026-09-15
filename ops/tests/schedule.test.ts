import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import { db } from "../lib/db";
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
  it("starts on Monday whatever day you ask from", () => {
    for (const d of ["2026-09-14", "2026-09-17", "2026-09-20"]) {
      const s = weekStart(new Date(`${d}T09:00:00`));
      assert.equal(s.getDay(), 1, `${d} should land on a Monday`);
      assert.equal(s.getHours(), 0);
    }
  });

  it("a Sunday belongs to the week that just ended, not the one starting", () => {
    const sunday = new Date("2026-09-20T15:00:00");
    const start = weekStart(sunday);
    assert.equal(start.getDate(), 14);
  });

  it("buckets events into seven days, Monday first", () => {
    const from = weekStart(new Date("2026-09-14T00:00:00"));
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
    const from = weekStart(new Date("2026-09-14T00:00:00"));
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
