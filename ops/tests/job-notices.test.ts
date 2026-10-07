/**
 * What opening a job tells the world: the client's summary email and the
 * calendar entries (lib/job-notices.ts), and sending them against stand-ins
 * for Resend and Google (lib/job-notices-send.ts).
 */
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";

import { db } from "../lib/db";
import { _resetCalendarToken, pushAllDay, type Fetch } from "../lib/google-calendar";
import {
  DEFAULT_REMINDERS,
  addDaysTo,
  isDay,
  plannedEntries,
  readNoticeChoices,
  reminderLabel,
  summaryEmail,
  type JobSummary,
} from "../lib/job-notices";
import { sendJobNotices } from "../lib/job-notices-send";
import { createJob, validateNewJob } from "../lib/new-job";

const job: JobSummary = {
  jobNumber: "HP-3103-001",
  clientName: "Hills Kitchens",
  greetName: "Dana Lee",
  phone: "08 8370 1200",
  jobType: "FULL_BENCHTOP",
  address: "12 Example St",
  suburb: "Stirling",
  siteContactName: "Pat Homeowner",
  siteContactPhone: "0498 765 432",
  stone: "Dekton Lunar · 20 mm · Matte",
  sqm: 4.2,
  notes: "Undermount sink",
  target: "2031-04-14",
};

describe("the days", () => {
  it("knows a real day from a typo, and counts across months", () => {
    assert.ok(isDay("2031-02-28"));
    assert.ok(!isDay("2031-02-30"));
    assert.ok(!isDay("14/04/2031"));
    assert.equal(addDaysTo("2031-03-30", 7), "2031-04-06");
    assert.equal(addDaysTo("2031-03-01", -1), "2031-02-28");
  });

  it("names reminders the way people say them", () => {
    assert.deepEqual([14, 7, 3, 1].map(reminderLabel), ["2 weeks before", "1 week before", "3 days before", "1 day before"]);
  });
});

describe("what the form may ask for", () => {
  const today = "2031-03-15";

  it("takes a target, its preset reminders, and the email choice", () => {
    const r = readNoticeChoices({ targetDate: "2031-04-14", reminders: "1,7,7,5,abc", emailClient: "on" }, today);
    assert.ok(r.ok);
    assert.deepEqual(r.value, { target: "2031-04-14", reminderDays: [7, 1], emailClient: true });
  });

  it("drops reminders with no target to count back from", () => {
    const r = readNoticeChoices({ targetDate: "", reminders: "7,1" }, today);
    assert.ok(r.ok);
    assert.deepEqual(r.value, { target: null, reminderDays: [], emailClient: false });
  });

  it("refuses a target that is not a day, has passed, or is years away", () => {
    for (const [targetDate, why] of [
      ["2031-02-30", /does not look right/],
      ["2031-03-14", /already passed/],
      ["2033-04-01", /two years/],
    ] as const) {
      const r = readNoticeChoices({ targetDate }, today);
      assert.ok(!r.ok);
      assert.match(r.reason, why);
    }
    assert.ok(readNoticeChoices({ targetDate: today }, today).ok, "today is allowed");
  });

  it("will not email a new client the form has no address for", () => {
    const form = {
      clientMode: "new", clientKind: "PERSON", clientName: "Jo Smith", phone: "0412 345 678", source: "PHONE",
      jobType: "REPAIR", address: "1 Test St", suburb: "Unley", emailClient: "on",
    };
    const r = validateNewJob(form, today);
    assert.ok(!r.ok);
    assert.match(r.reason, /client's email/);
    assert.ok(validateNewJob({ ...form, email: "jo@example.com" }, today).ok);
  });
});

describe("the client's email", () => {
  it("greets the contact by first name and lists everything entered", () => {
    const { subject, text } = summaryEmail(job, "0451 083 862");
    assert.equal(subject, "Your job with Haskel Project: HP-3103-001");
    assert.match(text, /^Hi Dana,/);
    for (const bit of [
      "Job number: HP-3103-001",
      "Kind of job: Full benchtop",
      "Site: 12 Example St, Stirling",
      "At the site: Pat Homeowner, 0498 765 432",
      "Stone: Dekton Lunar · 20 mm · Matte",
      "Area: about 4.2 m²",
      "We aim to finish by: Mon, 14 Apr 2031",
      "Notes: Undermount sink",
      "let us know: 0451 083 862.",
    ]) {
      assert.ok(text.includes(bit), bit);
    }
  });

  it("says when the stone is not chosen, and leaves out what was not given", () => {
    const { text } = summaryEmail({ ...job, stone: null, sqm: null, notes: null, target: null, siteContactName: null, siteContactPhone: null });
    assert.ok(text.includes("Stone: not chosen yet"));
    for (const gone of ["Area", "aim to finish", "Notes", "At the site", "let us know:"]) assert.ok(!text.includes(gone), gone);
    assert.ok(text.includes("please let us know."));
  });
});

describe("the calendar entries", () => {
  it("are the opening day, the target, and each reminder before it", () => {
    const e = plannedEntries(job, "2031-03-15", [1, 7]);
    assert.deepEqual(
      e.map((x) => [x.key, x.day]),
      [
        ["opened", "2031-03-15"],
        ["due", "2031-04-14"],
        ["reminder-7", "2031-04-07"],
        ["reminder-1", "2031-04-13"],
      ],
    );
    assert.equal(e[0].summary, "Opened · HP-3103-001 · Hills Kitchens");
    assert.equal(e[1].summary, "Due · HP-3103-001 · Hills Kitchens");
    assert.equal(e[2].summary, "Reminder · HP-3103-001 · Hills Kitchens due in 1 week");
    assert.equal(e[0].location, "12 Example St, Stirling");
    assert.ok(e[2].description.startsWith("Due Mon, 14 Apr 2031."));
  });

  it("leaves out reminders that would already have passed", () => {
    const e = plannedEntries({ ...job, target: "2031-03-18" }, "2031-03-15", [14, 7, 3, 1]);
    assert.deepEqual(e.map((x) => x.key), ["opened", "due", "reminder-3", "reminder-1"]);
  });

  it("is only the opening day when there is no target", () => {
    assert.deepEqual(plannedEntries({ ...job, target: null }, "2031-03-15", DEFAULT_REMINDERS).map((x) => x.key), ["opened"]);
  });
});

// ---- sending, against stand-ins

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const ENV = ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_CALENDAR_ID", "RESEND_API_KEY", "MAIL_FROM", "BUSINESS_CONTACT"] as const;
const saved = ENV.map((k) => process.env[k]);

function configure(on: { calendar: boolean; mail: boolean }) {
  for (const k of ENV) delete process.env[k];
  if (on.calendar) {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({
      client_email: "ops@test.iam.gserviceaccount.com",
      private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
    });
    process.env.GOOGLE_CALENDAR_ID = "cal@test";
  }
  if (on.mail) {
    process.env.RESEND_API_KEY = "re_test";
    process.env.MAIL_FROM = "Haskel Ops <noreply@haskelproject.com.au>";
  }
}

type Call = { url: string; body: Record<string, unknown> | null };

/** Google and Resend in one: `fail` names a URL fragment to refuse after `okFirst` successes. */
function services(fail?: { match: string; okFirst?: number }) {
  const calls: Call[] = [];
  let n = 0;
  const fetchFn: Fetch = async (url, init) => {
    const body = typeof init.body === "string" && init.body.startsWith("{") ? JSON.parse(init.body) : null;
    calls.push({ url, body });
    if (url.includes("oauth2")) return Response.json({ access_token: "tok", expires_in: 3600 });
    if (fail && url.includes(fail.match) && n++ >= (fail.okFirst ?? 0)) {
      return Response.json({ error: { message: "nope" }, message: "nope" }, { status: 500 });
    }
    if (url.includes("resend")) return Response.json({ id: "mail1" });
    return Response.json({ id: `evt${calls.length}` });
  };
  return { fetchFn, calls, events: () => calls.filter((c) => c.url.includes("/events")) };
}

describe("writing an all-day entry", () => {
  beforeEach(() => {
    configure({ calendar: true, mail: false });
    _resetCalendarToken();
  });
  after(() => ENV.forEach((k, i) => (saved[i] === undefined ? delete process.env[k] : (process.env[k] = saved[i]))));

  it("sends a whole day, ending the day after, marked free", async () => {
    const g = services();
    const r = await pushAllDay({ day: "2031-12-31", summary: "Due", description: "d", location: "l" }, g.fetchFn);
    assert.ok(r.ok);
    const [ev] = g.events();
    assert.deepEqual(ev.body?.start, { date: "2031-12-31" });
    assert.deepEqual(ev.body?.end, { date: "2032-01-01" });
    assert.equal(ev.body?.transparency, "transparent");
  });
});

describe("sending a new job's notices", () => {
  const FAR = new Date("2031-03-15T02:00:00Z");
  const TAG = `notices-${Date.now()}`;
  let adminId: string;
  const orderIds: string[] = [];
  const customerIds: string[] = [];

  before(async () => {
    const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
    assert.ok(admin);
    adminId = admin.id;
  });

  beforeEach(() => _resetCalendarToken());

  after(async () => {
    ENV.forEach((k, i) => (saved[i] === undefined ? delete process.env[k] : (process.env[k] = saved[i])));
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
    await db.$disconnect();
  });

  let seq = 0;
  async function open(extra: Record<string, unknown> = {}) {
    seq++;
    const v = validateNewJob(
      {
        clientMode: "new", clientKind: "PERSON", clientName: `${TAG} ${seq}`, source: "PHONE",
        phone: `04${String(Date.now()).slice(-7)}${seq}`, email: "jo@example.com",
        jobType: "VANITY_TOP", address: "12 Example St", suburb: "Prospect",
        targetDate: "2031-04-14", reminders: "7,1", ...extra,
      },
      "2031-03-15",
    );
    assert.ok(v.ok, v.ok ? "" : v.reason);
    const r = await createJob(v.value, adminId, FAR);
    assert.ok(r.ok);
    orderIds.push(r.orderId);
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { customerId: true } });
    customerIds.push(o.customerId);
    return r.orderId;
  }

  it("emails the client, adds every entry, and records both on the job", async () => {
    configure({ calendar: true, mail: true });
    process.env.BUSINESS_CONTACT = "0451 083 862";
    const id = await open();
    const g = services();
    const r = await sendJobNotices(id, { emailClient: true }, g.fetchFn, FAR);
    assert.deepEqual(r, { email: "sent", calendar: "added" });

    const mail = g.calls.find((c) => c.url.includes("resend"));
    assert.deepEqual(mail?.body?.to, ["jo@example.com"]);
    assert.match(String(mail?.body?.text), /We aim to finish by: Mon, 14 Apr 2031/);
    assert.equal(g.events().length, 4, "opened, due and two reminders");

    const o = await db.order.findUniqueOrThrow({ where: { id } });
    assert.equal(o.calendarEventIds.length, 4);
    assert.deepEqual(o.reminderDays, [7, 1]);
    assert.ok(o.summaryEmailedAt);
    assert.equal(o.targetCompletionAt?.toISOString(), "2031-04-13T14:30:00.000Z", "midnight in Adelaide");
  });

  it("does nothing outside when neither is set up, and says so", async () => {
    configure({ calendar: false, mail: false });
    const id = await open();
    const g = services();
    assert.deepEqual(await sendJobNotices(id, { emailClient: true }, g.fetchFn, FAR), {
      email: "not-configured",
      calendar: "not-configured",
    });
    assert.equal(g.calls.length, 0);
  });

  it("does not email when not asked to", async () => {
    configure({ calendar: false, mail: true });
    const id = await open();
    const g = services();
    const r = await sendJobNotices(id, { emailClient: false }, g.fetchFn, FAR);
    assert.equal(r.email, "skipped");
    assert.ok(!g.calls.some((c) => c.url.includes("resend")));
  });

  it("keeps the entries already made when a later one fails, and reports the failure", async () => {
    configure({ calendar: true, mail: false });
    const id = await open();
    const g = services({ match: "/events", okFirst: 2 });
    const r = await sendJobNotices(id, { emailClient: false }, g.fetchFn, FAR);
    assert.equal(r.calendar, "failed");
    assert.match(r.detail ?? "", /Calendar: Google said 500/);
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    assert.equal(o.calendarEventIds.length, 2, "the two that were made are tracked");
  });

  it("reports a failed email without stopping the calendar", async () => {
    configure({ calendar: true, mail: true });
    const id = await open({ targetDate: "", reminders: "" });
    const g = services({ match: "resend" });
    const r = await sendJobNotices(id, { emailClient: true }, g.fetchFn, FAR);
    assert.equal(r.email, "failed");
    assert.equal(r.calendar, "added");
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    assert.equal(o.summaryEmailedAt, null);
    assert.equal(o.calendarEventIds.length, 1, "just the opening day");
  });
});
