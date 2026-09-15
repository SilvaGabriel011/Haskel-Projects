/**
 * Google Calendar sync.
 *
 * STATUS: the pure half — deciding what a booking should look like as a
 * calendar event — is implemented and unit-tested. The network half cannot be
 * verified without a real Google Cloud project, so until credentials exist
 * every call returns `{ ok: false, reason: "not-configured" }` and the app
 * carries on. Nothing here throws when Google is absent; scheduling works
 * whether or not the sync is switched on.
 *
 * When credentials land: point GOOGLE_CALENDAR_ID at a THROWAWAY calendar,
 * confirm create/update/delete round-trip, then switch to the company one.
 * Never develop against the live calendar.
 */
import type { EventKind } from "@prisma/client";

/** Adelaide does not sit on a whole-hour offset, so never hardcode one. */
export const BUSINESS_TIMEZONE = "Australia/Adelaide";

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
export function toCalendarPayload(b: BookingForCalendar): CalendarPayload {
  const who = b.customerName ?? "Internal";
  const summary = `${KIND_TITLE[b.kind]} — ${who}`;

  const lines = [
    b.jobNumber ? `Job ${b.jobNumber}` : null,
    b.customerPhone ? `Phone ${b.customerPhone}` : null,
    b.notes ?? null,
    "Booked from Haskel Ops. Changes made here may be overwritten.",
  ].filter(Boolean) as string[];

  return {
    summary,
    description: lines.join("\n"),
    location: b.address,
    start: { dateTime: b.startAt.toISOString(), timeZone: BUSINESS_TIMEZONE },
    end: { dateTime: b.endAt.toISOString(), timeZone: BUSINESS_TIMEZONE },
    ...(b.assigneeEmails?.length ? { attendees: b.assigneeEmails.map((email) => ({ email })) } : {}),
  };
}

export type SyncResult =
  | { ok: true; googleEventId: string }
  | { ok: false; reason: "not-configured" | "failed"; detail?: string };

export function calendarConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CALENDAR_ID &&
      process.env.AUTH_GOOGLE_ID &&
      process.env.AUTH_GOOGLE_SECRET,
  );
}

/**
 * Push a booking to Google.
 *
 * Deliberately returns a result rather than throwing: a calendar that is not
 * set up, or is briefly unreachable, must never stop someone booking a job.
 * The booking is the record; the calendar is a copy of it.
 */
export async function pushBooking(
  _booking: BookingForCalendar,
  _existingGoogleEventId?: string | null,
): Promise<SyncResult> {
  if (!calendarConfigured()) {
    return { ok: false, reason: "not-configured" };
  }
  // Intentionally unimplemented: writing an untested Google API call would
  // look finished without being so. Implemented and verified against a
  // throwaway calendar as soon as credentials exist.
  return { ok: false, reason: "not-configured", detail: "Sync not yet enabled." };
}
