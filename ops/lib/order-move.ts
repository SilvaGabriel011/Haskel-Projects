/**
 * Moving a job to its next stage.
 *
 * Kept out of the server action so it can be tested without a session, like
 * lib/booking-accept.ts: the action adds who is signed in and the page refresh.
 *
 * The race this closes: the stage used to be read, checked, and only later
 * written, with the write not caring what the stage was by then. A double
 * click, or two people on the same job, both saw the old stage, both passed
 * the check, and both wrote — two spells opened for one move, the first one
 * closed after a few milliseconds, and the timeline counted the job twice.
 * Now the write IS the check: "move where still at the stage we checked", and
 * whoever gets zero rows back lost and changes nothing.
 *
 * Marking a job lost also gives back any stock it was holding. A lost job will
 * never cut that offcut, and its page offers no way to release it afterwards.
 */
import type { OrderStatus } from "@prisma/client";

import { db } from "@/lib/db";
import { FINAL_STAGE, STAGE_LABEL, canTransition, requiresAdmin } from "@/lib/pipeline";
import type { Role } from "@/lib/roles";

export type MoveResult = { ok: true } | { ok: false; reason: string };

class Moved extends Error {}

export async function moveOrder(input: {
  orderId: string;
  to: OrderStatus;
  userId: string;
  role: Role;
  now?: Date;
}): Promise<MoveResult> {
  const { orderId, to } = input;

  const order = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
  if (!order) return { ok: false, reason: "That job no longer exists." };

  const check = canTransition(order.status, to);
  if (!check.ok) return check;

  if (input.role !== "ADMIN" && requiresAdmin(to)) {
    return { ok: false, reason: "Only the office can move a job to that stage." };
  }

  const at = input.now ?? new Date();

  try {
    await db.$transaction(async (tx) => {
      // The claim. Only one caller can move this job off the stage it was at.
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: order.status },
        data: {
          status: to,
          ...(to === "ORDER_ACTIVE" ? { wonAt: at } : {}),
          ...(to === FINAL_STAGE ? { completedAt: at } : {}),
        },
      });
      if (claimed.count === 0) throw new Moved();

      // Close whatever spell is open, whichever stage it is for: there is only
      // ever one, and leaving a stale open row would show the job in two places.
      await tx.orderStage.updateMany({
        where: { orderId, exitedAt: null },
        data: { exitedAt: at },
      });

      // LOST is not a stage, so it opens no new spell — the job stops here.
      if (to !== "LOST") {
        await tx.orderStage.create({
          data: { orderId, stage: to, enteredAt: at, movedById: input.userId },
        });
        return;
      }

      await releaseEverythingHeld(tx, orderId, input.userId);
    });
  } catch (e) {
    if (!(e instanceof Moved)) throw e;
    const now = await db.order.findUnique({ where: { id: orderId }, select: { status: true } });
    return {
      ok: false,
      reason: now
        ? `Someone moved this job to ${STAGE_LABEL[now.status]} a moment ago.`
        : "That job no longer exists.",
    };
  }

  return { ok: true };
}

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Give back every piece whose latest reservation is this job's.
 *
 * Same rule as heldBy in lib/reservations.ts — the newest RESERVED movement
 * names the holder — applied to every piece this job ever reserved.
 */
async function releaseEverythingHeld(tx: Tx, orderId: string, userId: string) {
  const reserved = await tx.stockMovement.findMany({
    where: { orderId, kind: "RESERVED" },
    select: { offcutId: true, slabId: true },
  });

  const offcutIds = [...new Set(reserved.flatMap((m) => (m.offcutId ? [m.offcutId] : [])))];
  const slabIds = [...new Set(reserved.flatMap((m) => (m.slabId ? [m.slabId] : [])))];

  const holder = (where: { offcutId: string } | { slabId: string }) =>
    tx.stockMovement.findFirst({
      where: { kind: "RESERVED", orderId: { not: null }, ...where },
      orderBy: { createdAt: "desc" },
      select: { orderId: true },
    });

  for (const offcutId of offcutIds) {
    if ((await holder({ offcutId }))?.orderId !== orderId) continue;
    const res = await tx.offcut.updateMany({ where: { id: offcutId, status: "RESERVED" }, data: { status: "AVAILABLE" } });
    if (res.count) {
      await tx.stockMovement.create({
        data: { kind: "RELEASED", offcutId, orderId, userId, note: "Job marked lost" },
      });
    }
  }
  for (const slabId of slabIds) {
    if ((await holder({ slabId }))?.orderId !== orderId) continue;
    const res = await tx.slab.updateMany({ where: { id: slabId, status: "RESERVED" }, data: { status: "IN_STOCK" } });
    if (res.count) {
      await tx.stockMovement.create({
        data: { kind: "RELEASED", slabId, orderId, userId, note: "Job marked lost" },
      });
    }
  }
}
