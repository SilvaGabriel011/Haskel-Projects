import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BUSINESS_TIMEZONE, calendarConfigured, pushBooking, toCalendarPayload } from "../lib/google-calendar";

const booking = {
  kind: "INSTALL" as const,
  startAt: new Date("2026-09-17T23:30:00.000Z"), // 9:00am Adelaide next day
  endAt: new Date("2026-09-18T02:30:00.000Z"),
  address: "12 Beach Rd, Henley Beach",
  notes: "Side gate code 4821",
  jobNumber: "HP-2609-051",
  customerName: "Sarah Okafor",
  customerPhone: "0451 083 862",
  assigneeEmails: ["installer@haskelprojects.com.au"],
};

describe("calendar payload", () => {
  it("names the job and who it is for", () => {
    const p = toCalendarPayload(booking);
    assert.equal(p.summary, "Install — Sarah Okafor");
  });

  it("carries the job number, phone and site notes into the description", () => {
    const p = toCalendarPayload(booking);
    assert.match(p.description, /HP-2609-051/);
    assert.match(p.description, /0451 083 862/);
    assert.match(p.description, /4821/);
  });

  it("warns that edits in Google may be overwritten", () => {
    assert.match(toCalendarPayload(booking).description, /may be overwritten/i);
  });

  it("stamps the business timezone rather than a fixed offset", () => {
    const p = toCalendarPayload(booking);
    assert.equal(p.start.timeZone, BUSINESS_TIMEZONE);
    assert.equal(p.end.timeZone, BUSINESS_TIMEZONE);
    // Adelaide is a half-hour offset and observes DST — a hardcoded one would
    // put an installer at the house at the wrong time.
    assert.ok(!/\+\d{2}:00$/.test(p.start.dateTime) || p.start.dateTime.endsWith("Z"));
  });

  it("puts the address in location, not buried in the description", () => {
    assert.equal(toCalendarPayload(booking).location, booking.address);
  });

  it("handles an internal booking with no customer", () => {
    const p = toCalendarPayload({ ...booking, customerName: null, jobNumber: null, customerPhone: null });
    assert.equal(p.summary, "Fabricate — Internal".replace("Fabricate", "Install"));
    assert.ok(!p.description.includes("undefined"));
    assert.ok(!p.description.includes("null"));
  });

  it("omits attendees rather than sending an empty list", () => {
    const p = toCalendarPayload({ ...booking, assigneeEmails: [] });
    assert.equal(p.attendees, undefined);
  });
});

describe("when Google is not set up", () => {
  it("reports not-configured instead of throwing", async () => {
    const res = await pushBooking(booking);
    assert.equal(res.ok, false);
    assert.equal(res.ok === false ? res.reason : null, "not-configured");
  });

  it("knows it is not configured", () => {
    assert.equal(calendarConfigured(), false);
  });
});
