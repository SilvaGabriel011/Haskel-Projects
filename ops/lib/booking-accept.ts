/**
 * Turning a booking request into a job.
 *
 * Kept out of the server action so it can be tested without a session: the
 * action adds the admin check, the calendar write and page revalidation.
 *
 * Two races this closes, both of which used to be possible:
 *
 *  1. Accepting the same request twice. The status used to be read, and only
 *     later written, so a double click or two open tabs both saw NEW and both
 *     created a customer, a job and a diary entry. Now the claim IS the check:
 *     "set ACCEPTED where still NEW" inside the transaction, and whoever gets
 *     zero rows back lost and changes nothing.
 *  2. Two accepts at once computing the same job number from a count. The
 *     unique index catches it; we retry with the next number instead of
 *     showing a database error.
 */
import { Prisma, type BookingRequest } from "@prisma/client";

import { zonedParts } from "@/lib/business-time";
import { db } from "@/lib/db";
import { findTimeConflicts, type TimeConflict } from "@/lib/conflicts";
import { customerWithPhone } from "@/lib/new-job";

export const MEASURE_MINUTES = 60;

export type AcceptResult =
  | { ok: true; orderId: string; jobNumber: string; eventId: string; startAt: Date; endAt: Date; request: BookingRequest }
  | { ok: false; reason: string; needsConfirmation?: never; conflicts?: never }
  | { ok: false; reason: string; needsConfirmation: true; conflicts: TimeConflict[] };

class AlreadyDecided extends Error {}

function jobNumberFor(now: Date, n: number) {
  const { year, month } = zonedParts(now);
  const yy = String(year).slice(2);
  const mm = String(month).padStart(2, "0");
  return `HP-${yy}${mm}-B${String(n).padStart(3, "0")}`;
}

const isJobNumberClash = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2002" &&
  JSON.stringify(e.meta ?? {}).includes("jobNumber");

export async function acceptBookingRequest(input: {
  id: string;
  userId: string;
  at?: string;
  /** Set once the admin has seen the clashes and chosen to book anyway. */
  confirmConflicts?: boolean;
  now?: Date;
}): Promise<AcceptResult> {
  const req = await db.bookingRequest.findUnique({ where: { id: input.id } });
  if (!req) return { ok: false, reason: "That request no longer exists." };
  if (req.status !== "NEW") return { ok: false, reason: `Already ${req.status.toLowerCase()}.` };

  const startAt = input.at ? new Date(input.at) : req.preferredAt;
  if (Number.isNaN(startAt.getTime())) return { ok: false, reason: "That time did not parse." };
  const endAt = new Date(startAt.getTime() + MEASURE_MINUTES * 60 * 1000);

  // Warn before writing anything. The admin is the one being booked.
  if (!input.confirmConflicts) {
    const conflicts = await findTimeConflicts(startAt, endAt, [input.userId]);
    if (conflicts.length) {
      return {
        ok: false,
        needsConfirmation: true,
        conflicts,
        reason: `This clashes with ${conflicts.length === 1 ? "a job" : `${conflicts.length} jobs`} already in your diary.`,
      };
    }
  }

  const now = input.now ?? new Date();
  const base = (await db.bookingRequest.count({ where: { status: "ACCEPTED" } })) + 1;

  for (let attempt = 0; attempt < 5; attempt++) {
    const jobNumber = jobNumberFor(now, base + attempt);
    try {
      const { order, event } = await db.$transaction(async (tx) => {
        // The claim. Only one caller can move this row off NEW.
        const claimed = await tx.bookingRequest.updateMany({
          where: { id: req.id, status: "NEW" },
          data: { status: "ACCEPTED", decidedAt: now },
        });
        if (claimed.count === 0) throw new AlreadyDecided();

        // Match an existing customer on phone before making a duplicate. By
        // the number, not the typing: "+61 8 8370 1200" from the website is
        // the "08 8370 1200" the office has on file.
        const customer =
          (await customerWithPhone(tx, req.phone)) ??
          (await tx.customer.create({
            data: { name: req.name, phone: req.phone, email: req.email, suburb: req.suburb, source: "WEBSITE" },
          }));

        const order = await tx.order.create({
          data: {
            jobNumber,
            customerId: customer.id,
            // Small work by default; reclassified later if it turns out to be
            // a benchtop install. The classification no longer changes the
            // stages — every job runs all eleven.
            pipeline: "SHORT",
            jobType: req.jobType,
            status: "INITIAL",
            address: "To confirm on the call",
            suburb: req.suburb,
            notes: req.notes,
          },
        });

        // Open the first stage, as New job does, so the timeline and the
        // follow-up board count this job's days from the moment it was accepted.
        await tx.orderStage.create({
          data: { orderId: order.id, stage: "INITIAL", enteredAt: now, movedById: input.userId },
        });

        const event = await tx.scheduleEvent.create({
          data: {
            orderId: order.id,
            kind: "TEMPLATE",
            startAt,
            endAt,
            address: `${req.suburb}, address to confirm`,
            notes: `From a website booking request. ${req.notes ?? ""}`.trim(),
          },
        });
        await tx.scheduleAssignee.create({ data: { eventId: event.id, userId: input.userId } });
        await tx.bookingRequest.update({ where: { id: req.id }, data: { orderId: order.id } });

        return { order, event };
      });

      return {
        ok: true,
        orderId: order.id,
        jobNumber: order.jobNumber,
        eventId: event.id,
        startAt,
        endAt,
        request: req,
      };
    } catch (e) {
      if (e instanceof AlreadyDecided) {
        const now2 = await db.bookingRequest.findUnique({ where: { id: req.id }, select: { status: true } });
        return { ok: false, reason: `Already ${(now2?.status ?? "decided").toLowerCase()}.` };
      }
      if (isJobNumberClash(e)) continue; // someone took that number a moment ago
      throw e;
    }
  }
  return { ok: false, reason: "Could not allocate a job number. Try again." };
}

/** Same claim pattern for declining: only a request still NEW can be declined. */
export async function declineBookingRequest(id: string, note?: string) {
  const res = await db.bookingRequest.updateMany({
    where: { id, status: "NEW" },
    data: { status: "DECLINED", decidedAt: new Date(), declineNote: note?.slice(0, 500) || null },
  });
  if (res.count === 1) return { ok: true as const };
  const req = await db.bookingRequest.findUnique({ where: { id }, select: { status: true } });
  return { ok: false as const, reason: req ? `Already ${req.status.toLowerCase()}.` : "That request no longer exists." };
}
