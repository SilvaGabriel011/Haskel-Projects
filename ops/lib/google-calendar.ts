/**
 * Google Calendar sync.
 *
 * Two halves. Deciding what a booking looks like as a calendar event is pure
 * and unit tested (toCalendarPayload). Sending it is the network half: a
 * Google service account, a robot login only this app uses, writes to one
 * calendar that has been shared with it. No one's personal Google login is
 * involved and nothing asks anyone to sign in.
 *
 * Set up (README, "Google Calendar"): GOOGLE_SERVICE_ACCOUNT_JSON (the key
 * file, pasted whole), GOOGLE_CALENDAR_ID and BUSINESS_TIMEZONE. Without all
 * three every call returns `{ ok: false, reason: "not-configured" }` and the
 * app carries on: the booking is the record, the calendar only a copy of it.
 * Nothing here throws.
 *
 * Point GOOGLE_CALENDAR_ID at a throwaway calendar first and use "Send a test
 * event" in Settings, then switch it to the company one.
 */
import { createSign } from "node:crypto";

import type { EventKind } from "@prisma/client";

/**
 * The IANA zone the business works in (e.g. "Australia/Adelaide"), from
 * BUSINESS_TIMEZONE. Never hardcode an offset: several Australian zones sit on
 * half hours and most observe DST. Unset or unrecognised means no sync, rather
 * than events landing in the diary at a guessed time.
 */
export function businessTimezone(): string | null {
  const tz = process.env.BUSINESS_TIMEZONE?.trim();
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

export type CalendarPayload = {
  summary: string;
  description: string;
  location: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  attendees?: Array<{ email: string }>;
};

export type BookingForCalendar = {
  kind: EventKind;
  startAt: Date;
  endAt: Date;
  address: string;
  notes?: string | null;
  jobNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  assigneeEmails?: string[];
  /** Who is booked, by name: the calendar cannot invite them (see pushBooking). */
  crew?: string[];
};

const KIND_TITLE: Record<EventKind, string> = {
  TEMPLATE: "Template",
  FABRICATE: "Fabricate",
  INSTALL: "Install",
  REPAIR: "Repair",
  DELIVERY: "Delivery",
};

/**
 * Turn a booking into the event body Google expects.
 *
 * Pure and deterministic — this is the part worth testing, and it is where the
 * mistakes that matter live: a wrong timezone puts an installer at a house at
 * the wrong hour.
 */
export function toCalendarPayload(b: BookingForCalendar, timeZone: string): CalendarPayload {
  const who = b.customerName ?? "Internal";
  const summary = `${KIND_TITLE[b.kind]} — ${who}`;

  const lines = [
    b.jobNumber ? `Job ${b.jobNumber}` : null,
    b.customerPhone ? `Phone ${b.customerPhone}` : null,
    b.crew?.length ? `Crew ${b.crew.join(", ")}` : null,
    b.notes ?? null,
    "Booked from Haskel Ops. Changes made here may be overwritten.",
  ].filter(Boolean) as string[];

  return {
    summary,
    description: lines.join("\n"),
    location: b.address,
    start: { dateTime: b.startAt.toISOString(), timeZone },
    end: { dateTime: b.endAt.toISOString(), timeZone },
    ...(b.assigneeEmails?.length ? { attendees: b.assigneeEmails.map((email) => ({ email })) } : {}),
  };
}

export type SyncResult =
  | { ok: true; googleEventId: string }
  | { ok: false; reason: "not-configured" | "failed"; detail?: string };

type ServiceAccount = { clientEmail: string; privateKey: string };

/**
 * The service account from GOOGLE_SERVICE_ACCOUNT_JSON: the key file Google
 * gives you, pasted whole. Null if absent or not a key file.
 */
export function serviceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  if (!raw) return null;
  try {
    const key = JSON.parse(raw) as { client_email?: unknown; private_key?: unknown };
    if (typeof key.client_email !== "string" || typeof key.private_key !== "string") return null;
    // Pasted into a one-line setting, the key's line breaks can arrive as "\n".
    return { clientEmail: key.client_email, privateKey: key.private_key.replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

export function calendarId(): string | null {
  return process.env.GOOGLE_CALENDAR_ID?.trim() || null;
}

/** What is missing, in words, for Settings. Empty when everything is set. */
export function calendarMissing(): string[] {
  const missing: string[] = [];
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) missing.push("GOOGLE_SERVICE_ACCOUNT_JSON");
  else if (!serviceAccount()) missing.push("GOOGLE_SERVICE_ACCOUNT_JSON (not a key file)");
  if (!calendarId()) missing.push("GOOGLE_CALENDAR_ID");
  if (!businessTimezone()) missing.push("BUSINESS_TIMEZONE");
  return missing;
}

export function calendarConfigured(): boolean {
  return calendarMissing().length === 0;
}

/** fetch, passed in by the tests so they can stand in for Google. */
export type Fetch = (url: string, init: RequestInit) => Promise<Response>;

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** The signed assertion Google swaps for an access token (RFC 7523). */
export function tokenAssertion(sa: ServiceAccount, now = Date.now()): string {
  const iat = Math.floor(now / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }));
  const signature = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.privateKey);
  return `${head}.${claims}.${b64url(signature)}`;
}

let cached: { token: string; until: number; who: string } | null = null;

async function accessToken(sa: ServiceAccount, fetchFn: Fetch): Promise<string> {
  if (cached && cached.who === sa.clientEmail && cached.until > Date.now() + 60_000) return cached.token;
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: tokenAssertion(sa),
    }).toString(),
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(`Google refused the service account: ${body.error_description ?? body.error ?? res.status}`);
  }
  cached = { token: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000, who: sa.clientEmail };
  return body.access_token;
}

/** Forget the cached token; tests start each case clean. */
export function _resetCalendarToken() {
  cached = null;
}

/** Google's own words for a failed call, so Settings can show what went wrong. */
async function googleError(res: Response): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
  const message = body?.error?.message ?? res.statusText;
  if (res.status === 404) return `Calendar not found, or not shared with the service account (${message}).`;
  if (res.status === 403) return `The service account may not write to this calendar: share it with "Make changes to events" (${message}).`;
  return `Google said ${res.status}: ${message}`;
}

/**
 * Push a booking to Google: create it, or update the event made last time.
 *
 * Deliberately returns a result rather than throwing: a calendar that is not
 * set up, or is briefly unreachable, must never stop someone booking a job.
 *
 * No attendees are sent: a service account may not invite people without
 * Workspace-wide delegation, and Google refuses the whole event if it tries.
 * The crew are named in the description instead.
 */
export async function pushBooking(
  booking: BookingForCalendar,
  existingGoogleEventId?: string | null,
  fetchFn: Fetch = fetch,
): Promise<SyncResult> {
  const sa = serviceAccount();
  const cal = calendarId();
  const tz = businessTimezone();
  if (!sa || !cal || !tz) return { ok: false, reason: "not-configured" };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { attendees, ...payload } = toCalendarPayload(booking, tz);
  try {
    const token = await accessToken(sa, fetchFn);
    const base = `${API}/calendars/${encodeURIComponent(cal)}/events`;
    const res = await fetchFn(existingGoogleEventId ? `${base}/${encodeURIComponent(existingGoogleEventId)}` : base, {
      method: existingGoogleEventId ? "PUT" : "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, reason: "failed", detail: await googleError(res) };
    const event = (await res.json()) as { id?: string };
    if (!event.id) return { ok: false, reason: "failed", detail: "Google answered without an event id." };
    return { ok: true, googleEventId: event.id };
  } catch (e) {
    return { ok: false, reason: "failed", detail: e instanceof Error ? e.message : String(e) };
  }
}

/** Remove an event this app made. Already gone counts as removed. */
export async function removeBooking(googleEventId: string, fetchFn: Fetch = fetch): Promise<{ ok: boolean; detail?: string }> {
  const sa = serviceAccount();
  const cal = calendarId();
  if (!sa || !cal) return { ok: false, detail: "Not configured." };
  try {
    const token = await accessToken(sa, fetchFn);
    const res = await fetchFn(`${API}/calendars/${encodeURIComponent(cal)}/events/${encodeURIComponent(googleEventId)}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok || res.status === 404 || res.status === 410) return { ok: true };
    return { ok: false, detail: await googleError(res) };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Prove the whole round trip from Settings: write an event an hour from now,
 * then delete it. Says exactly where it stopped if it fails.
 */
export async function sendTestEvent(fetchFn: Fetch = fetch, now = new Date()): Promise<{ ok: true } | { ok: false; detail: string }> {
  const missing = calendarMissing();
  if (missing.length) return { ok: false, detail: `Not set: ${missing.join(", ")}.` };
  const start = new Date(now.getTime() + 60 * 60 * 1000);
  const made = await pushBooking(
    {
      kind: "TEMPLATE",
      startAt: start,
      endAt: new Date(start.getTime() + 15 * 60 * 1000),
      address: "Test only",
      notes: "A test from Haskel Ops Settings. It deletes itself straight away.",
      customerName: "Haskel Ops test",
    },
    null,
    fetchFn,
  );
  if (!made.ok) return { ok: false, detail: made.detail ?? "Could not write to the calendar." };
  const gone = await removeBooking(made.googleEventId, fetchFn);
  if (!gone.ok) return { ok: false, detail: `Wrote the test event but could not delete it: ${gone.detail}` };
  return { ok: true };
}
