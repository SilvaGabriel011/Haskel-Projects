"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { pushBooking } from "@/lib/google-calendar";

/**
 * Accepting a request is the moment it becomes real.
 *
 * Until now it was a stranger's preference. Accepting creates — in one
 * transaction — the customer, the job at ENQUIRY, and the diary entry. The
 * calendar write happens after, and is allowed to fail: the booking is the
 * record, the calendar is a copy of it.
 */
export async function acceptBooking(id: string, at?: string) {
  const me = await requireAdmin();

  const req = await db.bookingRequest.findUnique({ where: { id } });
  if (!req) return { ok: false as const, reason: "That request no longer exists." };
  if (req.status !== "NEW") return { ok: false as const, reason: `Already ${req.status.toLowerCase()}.` };

  const startAt = at ? new Date(at) : req.preferredAt;
  if (Number.isNaN(startAt.getTime())) {
    return { ok: false as const, reason: "That time did not parse." };
  }
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);

  const jobNumber = `HP-${new Date().getFullYear().toString().slice(2)}${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-B${String(await db.bookingRequest.count({ where: { status: "ACCEPTED" } }) + 1).padStart(3, "0")}`;

  const { order, event } = await db.$transaction(async (tx) => {
    // Match an existing customer on phone before making a duplicate.
    const customer =
      (await tx.customer.findFirst({ where: { phone: req.phone } })) ??
      (await tx.customer.create({
        data: {
          name: req.name,
          phone: req.phone,
          email: req.email,
          suburb: req.suburb,
          source: "WEBSITE",
        },
      }));

    const order = await tx.order.create({
      data: {
        jobNumber,
        customerId: customer.id,
        // A measure is the front of the short pipeline; it moves to FULL later
        // if it turns out to be a benchtop install.
        pipeline: "SHORT",
        jobType: req.jobType,
        status: "ENQUIRY",
        address: "To confirm on the call",
        suburb: req.suburb,
        notes: req.notes,
      },
    });

    const event = await tx.scheduleEvent.create({
      data: {
        orderId: order.id,
        kind: "TEMPLATE",
        startAt,
        endAt,
        address: `${req.suburb} — address to confirm`,
        notes: `From a website booking request. ${req.notes ?? ""}`.trim(),
      },
    });

    await tx.scheduleAssignee.create({ data: { eventId: event.id, userId: me.id } });

    await tx.bookingRequest.update({
      where: { id },
      data: { status: "ACCEPTED", decidedAt: new Date(), orderId: order.id },
    });

    return { order, event };
  });

  // Outside the transaction on purpose: a calendar outage must not roll back a
  // confirmed booking.
  const sync = await pushBooking({
    kind: "TEMPLATE",
    startAt: event.startAt,
    endAt: event.endAt,
    address: event.address,
    notes: event.notes,
    jobNumber: order.jobNumber,
    customerName: req.name,
    customerPhone: req.phone,
  });

  if (sync.ok) {
    await db.scheduleEvent.update({
      where: { id: event.id },
      data: { googleEventId: sync.googleEventId },
    });
  }

  revalidatePath("/bookings");
  revalidatePath("/schedule");
  revalidatePath("/orders");

  return {
    ok: true as const,
    orderId: order.id,
    jobNumber: order.jobNumber,
    calendar: sync.ok ? ("synced" as const) : ("not-synced" as const),
  };
}

export async function declineBooking(id: string, note?: string) {
  await requireAdmin();

  const req = await db.bookingRequest.findUnique({ where: { id }, select: { status: true } });
  if (!req) return { ok: false as const, reason: "That request no longer exists." };
  if (req.status !== "NEW") return { ok: false as const, reason: `Already ${req.status.toLowerCase()}.` };

  await db.bookingRequest.update({
    where: { id },
    data: { status: "DECLINED", decidedAt: new Date(), declineNote: note?.slice(0, 500) || null },
  });
  revalidatePath("/bookings");
  return { ok: true as const };
}
