/**
 * Day boundaries and wall-clock times in the business zone, with the server
 * in UTC. Every case here was wrong before: the server's midnight is 8am in
 * Perth, and a datetime-local "09:00" was read as 09:00 UTC.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  addDays, daysBetween, formatTime, isoDay, monthKey, monthStart, parseWallTime, startOfDay, weekStart, zonedTime,
} from "../lib/business-time";

const PERTH = "Australia/Perth"; // UTC+8, no daylight saving
const ADL = "Australia/Adelaide"; // UTC+9:30 / +10:30, the awkward one

describe("wall time to instant", () => {
  it("9am in Perth is 1am UTC", () => {
    assert.equal(zonedTime(2026, 9, 30, 9, 0, PERTH).toISOString(), "2026-09-30T01:00:00.000Z");
  });

  it("handles a half-hour offset on both sides of daylight saving", () => {
    assert.equal(zonedTime(2026, 7, 1, 9, 0, ADL).toISOString(), "2026-06-30T23:30:00.000Z"); // winter, +9:30
    assert.equal(zonedTime(2026, 12, 1, 9, 0, ADL).toISOString(), "2026-11-30T22:30:00.000Z"); // summer, +10:30
  });

  it("reads a datetime-local value as business time, and leaves explicit zones alone", () => {
    assert.equal(parseWallTime("2026-09-30T09:00", PERTH).toISOString(), "2026-09-30T01:00:00.000Z");
    assert.equal(parseWallTime("2026-09-30T09:00:00.000Z", PERTH).toISOString(), "2026-09-30T09:00:00.000Z");
    assert.equal(parseWallTime("2026-09-30T09:00+10:00", PERTH).toISOString(), "2026-09-29T23:00:00.000Z");
  });
});

describe("day boundaries", () => {
  // 7am Monday 14 Sep in Perth is still Sunday 23:00 UTC.
  const earlyMonday = new Date("2026-09-13T23:00:00.000Z");

  it("an early Monday job belongs to Monday, not the Sunday before", () => {
    assert.equal(isoDay(earlyMonday, PERTH), "2026-09-14");
    assert.equal(weekStart(earlyMonday, PERTH).toISOString(), "2026-09-13T16:00:00.000Z"); // Mon 00:00 Perth
  });

  it("a Sunday evening belongs to the week that is ending", () => {
    const sundayNight = new Date("2026-09-20T13:00:00.000Z"); // 9pm Sunday Perth
    assert.equal(isoDay(weekStart(sundayNight, PERTH), PERTH), "2026-09-14");
  });

  it("midnight and next days are local midnights", () => {
    assert.equal(startOfDay(earlyMonday, PERTH).toISOString(), "2026-09-13T16:00:00.000Z");
    assert.equal(addDays(earlyMonday, 1, PERTH).toISOString(), "2026-09-14T16:00:00.000Z");
    assert.equal(daysBetween(weekStart(earlyMonday, PERTH), new Date("2026-09-19T15:00:00Z"), PERTH), 5); // Sat 11pm
  });

  it("a day across a daylight saving change is 23 hours, and addDays still lands on midnight", () => {
    // Adelaide springs forward on Sunday 4 Oct 2026.
    const sat = zonedTime(2026, 10, 3, 0, 0, ADL);
    const sun = addDays(sat, 1, ADL);
    const mon = addDays(sat, 2, ADL);
    assert.equal(isoDay(mon, ADL), "2026-10-05");
    assert.equal((mon.getTime() - sun.getTime()) / 3_600_000, 23);
  });

  it("months are local months", () => {
    const lastNightOfAugust = new Date("2026-08-31T17:00:00.000Z"); // 1am 1 Sep in Perth
    assert.equal(monthKey(lastNightOfAugust, PERTH), "2026-09");
    assert.equal(monthStart(lastNightOfAugust, 0, PERTH).toISOString(), "2026-08-31T16:00:00.000Z");
    assert.equal(isoDay(monthStart(lastNightOfAugust, 12, PERTH), PERTH), "2025-09-01");
  });
});

describe("display", () => {
  it("shows the Perth time, not the server's", () => {
    assert.equal(formatTime(new Date("2026-09-30T01:00:00.000Z"), PERTH).replace(/\s/g, " "), "9:00 am");
  });
});
