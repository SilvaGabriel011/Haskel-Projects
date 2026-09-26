import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { businessTimezone, calendarConfigured, pushBooking, toCalendarPayload } from "../lib/google-calendar";

/** Any real zone will do; the payload must carry whichever one it is given. */
const TZ = "Australia/Sydney";

const booking = {
  kind: "INSTALL" as const,
  startAt: new Date("2026-09-17T23:30:00.000Z"), // 9:30am next day in Sydney (AEST)
  endAt: new Date("2026-09-18T02:30:00.000Z"),
  address: "12 Beach Rd, Henley Beach",
  notes: "Side gate code 4821",
  jobNumber: "HP-2609-051",
  customerName: "Sarah Okafor",
  customerPhone: "0451 083 862",
  assigneeEmails: ["installer@haskelproject.com.au"],
};

describe("calendar payload", () => {
  it("names the job and who it is for", () => {
    const p = toCalendarPayload(booking, TZ);
    assert.equal(p.summary, "Install — Sarah Okafor");
  });

  it("carries the job number, phone and site notes into the description", () => {
    const p = toCalendarPayload(booking, TZ);
    assert.match(p.description, /HP-2609-051/);
    assert.match(p.description, /0451 083 862/);
    assert.match(p.description, /4821/);
  });

  it("warns that edits in Google may be overwritten", () => {
    assert.match(toCalendarPayload(booking, TZ).description, /may be overwritten/i);
  });

  it("stamps the business timezone rather than a fixed offset", () => {
    const p = toCalendarPayload(booking, TZ);
    assert.equal(p.start.timeZone, TZ);
    assert.equal(p.end.timeZone, TZ);
    // Some zones are half-hour offsets and most observe DST — a hardcoded one would
    // put an installer at the house at the wrong time.
    assert.ok(!/\+\d{2}:00$/.test(p.start.dateTime) || p.start.dateTime.endsWith("Z"));
  });

  it("puts the address in location, not buried in the description", () => {
    assert.equal(toCalendarPayload(booking, TZ).location, booking.address);
  });

  it("handles an internal booking with no customer", () => {
    const p = toCalendarPayload({ ...booking, customerName: null, jobNumber: null, customerPhone: null }, TZ);
    assert.equal(p.summary, "Fabricate — Internal".replace("Fabricate", "Install"));
    assert.ok(!p.description.includes("undefined"));
    assert.ok(!p.description.includes("null"));
  });

  it("omits attendees rather than sending an empty list", () => {
    const p = toCalendarPayload({ ...booking, assigneeEmails: [] }, TZ);
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

describe("business timezone", () => {
  const withTz = (value: string | undefined, fn: () => void) => {
    const prev = process.env.BUSINESS_TIMEZONE;
    if (value === undefined) delete process.env.BUSINESS_TIMEZONE;
    else process.env.BUSINESS_TIMEZONE = value;
    try {
      fn();
    } finally {
      if (prev === undefined) delete process.env.BUSINESS_TIMEZONE;
      else process.env.BUSINESS_TIMEZONE = prev;
    }
  };

  it("is absent until set, so sync never guesses a zone", () => {
    withTz(undefined, () => assert.equal(businessTimezone(), null));
    withTz("  ", () => assert.equal(businessTimezone(), null));
  });

  it("rejects a zone that does not exist", () => {
    withTz("Australia/Nowhere", () => assert.equal(businessTimezone(), null));
  });

  it("accepts a real IANA zone", () => {
    withTz(" Australia/Perth ", () => assert.equal(businessTimezone(), "Australia/Perth"));
  });

  it("keeps sync off without a zone even when Google is set up", () => {
    const keys = ["GOOGLE_CALENDAR_ID", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"] as const;
    const prev = keys.map((k) => process.env[k]);
    keys.forEach((k) => (process.env[k] = "x"));
    try {
      withTz(undefined, () => assert.equal(calendarConfigured(), false));
      withTz("Australia/Perth", () => assert.equal(calendarConfigured(), true));
    } finally {
      keys.forEach((k, i) => (prev[i] === undefined ? delete process.env[k] : (process.env[k] = prev[i])));
    }
  });
});
