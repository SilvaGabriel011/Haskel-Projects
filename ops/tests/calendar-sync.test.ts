/**
 * The network half of the calendar sync, against a stand-in for Google.
 *
 * The stand-in checks what Google would: the token request is a JWT signed
 * with the service account's key, and every calendar call carries the token
 * it handed out. A real key pair is made for the run, so the signing is real.
 */
import assert from "node:assert/strict";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";

import {
  _resetCalendarToken,
  calendarMissing,
  pushBooking,
  removeBooking,
  sendTestEvent,
  type Fetch,
} from "../lib/google-calendar";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = "haskel-ops@test-project.iam.gserviceaccount.com";
const CAL = "test-calendar@group.calendar.google.com";
const ENV = ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_CALENDAR_ID", "BUSINESS_TIMEZONE"] as const;
const saved = ENV.map((k) => process.env[k]);

const booking = {
  kind: "TEMPLATE" as const,
  startAt: new Date("2031-03-03T23:30:00Z"),
  endAt: new Date("2031-03-04T00:30:00Z"),
  address: "Stirling, address to confirm",
  jobNumber: "HP-3103-B001",
  customerName: "Jo Smith",
  customerPhone: "0412 345 678",
  assigneeEmails: ["admin@haskelproject.com.au"],
  crew: ["Gabriel Silva"],
};

type Call = { url: string; method: string; body: unknown };

/** A pretend Google. `answer` decides the calendar's replies. */
function google(answer: (call: Call) => { status: number; body?: unknown } = () => ({ status: 200, body: { id: "evt1" } })) {
  const calls: Call[] = [];
  const fetchFn: Fetch = async (url, init) => {
    const call = { url, method: init.method ?? "GET", body: init.body ? tryJson(String(init.body)) : null };
    calls.push(call);
    if (url === "https://oauth2.googleapis.com/token") {
      const assertion = new URLSearchParams(String(init.body)).get("assertion") ?? "";
      const [head, claims, sig] = assertion.split(".");
      const genuine = createVerify("RSA-SHA256").update(`${head}.${claims}`).verify(publicKey, Buffer.from(sig, "base64url"));
      const c = JSON.parse(Buffer.from(claims, "base64url").toString());
      if (!genuine || c.iss !== SA || !String(c.scope).includes("calendar.events")) {
        return Response.json({ error: "invalid_grant" }, { status: 400 });
      }
      return Response.json({ access_token: "tok-123", expires_in: 3600 });
    }
    if ((init.headers as Record<string, string>).authorization !== "Bearer tok-123") {
      return Response.json({ error: { message: "unauthorised" } }, { status: 401 });
    }
    const { status, body } = answer(call);
    return status === 204 ? new Response(null, { status }) : Response.json(body ?? {}, { status });
  };
  return { fetchFn, calls };
}

const tryJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
};

function configure(key = privateKey.export({ type: "pkcs8", format: "pem" }).toString()) {
  process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify({ type: "service_account", client_email: SA, private_key: key });
  process.env.GOOGLE_CALENDAR_ID = CAL;
  process.env.BUSINESS_TIMEZONE = "Australia/Adelaide";
}

beforeEach(() => {
  _resetCalendarToken();
  configure();
});

after(() => {
  ENV.forEach((k, i) => (saved[i] === undefined ? delete process.env[k] : (process.env[k] = saved[i])));
});

describe("writing to Google Calendar", () => {
  it("signs in as the service account and creates the event in the calendar", async () => {
    const g = google();
    const res = await pushBooking(booking, null, g.fetchFn);
    assert.deepEqual(res, { ok: true, googleEventId: "evt1" });

    const create = g.calls.find((c) => c.method === "POST" && c.url.includes("/events"))!;
    assert.equal(create.url, `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CAL)}/events`);
    const body = create.body as Record<string, unknown>;
    assert.equal(body.summary, "Template — Jo Smith");
    assert.equal((body.start as { timeZone: string }).timeZone, "Australia/Adelaide");
    assert.match(String(body.description), /Crew Gabriel Silva/);
    // A service account inviting people makes Google refuse the whole event.
    assert.equal(body.attendees, undefined);
  });

  it("updates the event it made last time instead of making a second one", async () => {
    const g = google();
    await pushBooking(booking, "evt1", g.fetchFn);
    const write = g.calls.filter((c) => c.url.includes("/events"));
    assert.equal(write.length, 1);
    assert.equal(write[0].method, "PUT");
    assert.ok(write[0].url.endsWith("/events/evt1"));
  });

  it("asks for a token once, not on every booking", async () => {
    const g = google();
    await pushBooking(booking, null, g.fetchFn);
    await pushBooking(booking, null, g.fetchFn);
    assert.equal(g.calls.filter((c) => c.url.includes("oauth2")).length, 1);
  });

  it("reads a key pasted with its line breaks as \\n", async () => {
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString().replace(/\n/g, "\\n");
    configure(pem);
    const res = await pushBooking(booking, null, google().fetchFn);
    assert.ok(res.ok);
  });

  it("says plainly when the calendar is not shared with the service account", async () => {
    const g = google(() => ({ status: 404, body: { error: { message: "Not Found" } } }));
    const res = await pushBooking(booking, null, g.fetchFn);
    assert.ok(!res.ok && res.reason === "failed");
    assert.match(res.detail ?? "", /not shared with the service account/);
  });

  it("never throws, even when Google cannot be reached", async () => {
    const res = await pushBooking(booking, null, async () => {
      throw new Error("getaddrinfo ENOTFOUND oauth2.googleapis.com");
    });
    assert.ok(!res.ok && /ENOTFOUND/.test(res.detail ?? ""));
  });

  it("deletes an event, and counts one already gone as deleted", async () => {
    assert.deepEqual(await removeBooking("evt1", google(() => ({ status: 204 })).fetchFn), { ok: true });
    assert.deepEqual(await removeBooking("evt1", google(() => ({ status: 410, body: {} })).fetchFn), { ok: true });
  });
});

describe("the test from Settings", () => {
  it("writes an event and deletes it again", async () => {
    const g = google((c) => (c.method === "DELETE" ? { status: 204 } : { status: 200, body: { id: "test-evt" } }));
    assert.deepEqual(await sendTestEvent(g.fetchFn), { ok: true });
    const methods = g.calls.filter((c) => c.url.includes("/events")).map((c) => c.method);
    assert.deepEqual(methods, ["POST", "DELETE"]);
  });

  it("says what is missing before trying anything", async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    const g = google();
    const res = await sendTestEvent(g.fetchFn);
    assert.ok(!res.ok && /GOOGLE_CALENDAR_ID/.test(res.detail));
    assert.equal(g.calls.length, 0);
    assert.deepEqual(calendarMissing(), ["GOOGLE_CALENDAR_ID"]);
  });

  it("names a setting that is there but is not a key file", () => {
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = "not json";
    assert.deepEqual(calendarMissing(), ["GOOGLE_SERVICE_ACCOUNT_JSON (not a key file)"]);
  });
});
