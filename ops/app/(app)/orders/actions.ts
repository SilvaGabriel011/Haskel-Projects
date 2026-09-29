"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { FINAL_STAGE, canTransition, requiresAdmin } from "@/lib/pipeline";
import { releaseStock, reserveStock, type StockKind } from "@/lib/reservations";
import type { OrderStatus } from "@prisma/client";

/**
 * Move a job to the next stage.
 *
 * Guarded three ways: the caller must be signed in, the transition must be
 * legal, and only an admin may quote, activate, order stone for, invoice or
 * lose a job — an installer moves work along the bench but cannot change what
 * it is worth or write it off.
 *
 * The move and its stage history are written in one transaction. If the closing
 * of the old spell and the opening of the new one could come apart, a job would
 * end up either counted in two stages at once or in none, and every figure on
 * the timeline would be wrong from then on.
 */
export async function advanceOrder(orderId: string, to: OrderStatus) {
  const user = await requireUser();

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, status: true },
  });
  if (!order) return { ok: false as const, reason: "That job no longer exists." };

  const check = canTransition(order.status, to);
  if (!check.ok) return { ok: false as const, reason: check.reason };

  if (user.role !== "ADMIN" && requiresAdmin(to)) {
    return { ok: false as const, reason: "Only the office can move a job to that stage." };
  }

  const at = new Date();

  await db.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...(to === "ORDER_ACTIVE" ? { wonAt: at } : {}),
        ...(to === FINAL_STAGE ? { completedAt: at } : {}),
      },
    });

    // Close whatever spell is open, whichever stage it is for: there is only
    // ever one, and leaving a stale open row would show the job in two places.
    await tx.orderStage.updateMany({
      where: { orderId, exitedAt: null },
      data: { exitedAt: at },
    });

    // LOST is not a stage, so it opens no new spell — the job stops here.
    if (to !== "LOST") {
      await tx.orderStage.create({
        data: { orderId, stage: to, enteredAt: at, movedById: user.id },
      });
    }
  });

  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true as const };
}

/**
 * Hold a slab or offcut for this job, or give it back.
 *
 * Any signed-in user may: installers pull stock for the jobs they cut. The
 * refusal when someone else got there first, and which job has it, come from
 * lib/reservations.ts.
 */
export async function reserveForOrder(orderId: string, kind: StockKind, itemId: string) {
  const user = await requireUser();
  const res = await reserveStock({ kind, itemId, orderId, userId: user.id });
  if (res.ok) revalidateStock(orderId);
  return res;
}

export async function releaseFromOrder(orderId: string, kind: StockKind, itemId: string) {
  const user = await requireUser();
  const res = await releaseStock({ kind, itemId, orderId, userId: user.id });
  if (res.ok) revalidateStock(orderId);
  return res;
}

function revalidateStock(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/stock");
  revalidatePath("/offcuts");
}
