"use server";

import { revalidatePath } from "next/cache";

import { acceptBookingRequest, declineBookingRequest } from "@/lib/booking-accept";
import { record } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { pushBooking } from "@/lib/google-calendar";

/**
 * Accepting a request is the moment it becomes real.
 *
 * The rules (one winner per request, a warning on a diary clash, a unique job
 * number) live in lib/booking-accept.ts where they are tested. This adds who
 * may do it, the calendar copy and the page refresh.
 *
 * A clash comes back as `needsConfirmation` with the jobs it overlaps; the page
 * shows them and calls again with `confirmConflicts` if the admin goes ahead.
 */
export async function acceptBooking(id: string, at?: string, confirmConflicts = false) {
  const me = await requireAdmin();

  const res = await acceptBookingRequest({ id, at, userId: me.id, confirmConflicts });
  if (!res.ok) return res;

  // Outside the transaction on purpose: a calendar outage must not roll back a
  // confirmed booking.
  const sync = await pushBooking({
    kind: "TEMPLATE",
    startAt: res.startAt,
    endAt: res.endAt,
    address: `${res.request.suburb}, address to confirm`,
    notes: res.request.notes,
    jobNumber: res.jobNumber,
    customerName: res.request.name,
    customerPhone: res.request.phone,
  });
  if (sync.ok) {
    await db.scheduleEvent.update({ where: { id: res.eventId }, data: { googleEventId: sync.googleEventId } });
  }

  await record(me, "booking.accepted", `Accepted ${res.request.name}'s booking as ${res.jobNumber}`, `/orders/${res.orderId}`);

  revalidatePath("/bookings");
  revalidatePath("/schedule");
  revalidatePath("/orders");

  return {
    ok: true as const,
    orderId: res.orderId,
    jobNumber: res.jobNumber,
    calendar: sync.ok ? ("synced" as const) : ("not-synced" as const),
  };
}

export async function declineBooking(id: string, note?: string) {
  const me = await requireAdmin();
  const res = await declineBookingRequest(id, note);
  if (res.ok) {
    const req = await db.bookingRequest.findUnique({ where: { id }, select: { name: true } });
    await record(me, "booking.declined", `Declined ${req?.name ?? "a"}'s booking request`, "/bookings");
    revalidatePath("/bookings");
  }
  return res;
}
