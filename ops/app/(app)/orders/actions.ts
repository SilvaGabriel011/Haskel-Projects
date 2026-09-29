"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { canTransition, requiresAdmin } from "@/lib/pipeline";
import { releaseStock, reserveStock, type StockKind } from "@/lib/reservations";
import type { OrderStatus } from "@prisma/client";

/**
 * Move a job to the next stage.
 *
 * Guarded three ways: the caller must be signed in, the transition must be
 * legal for that job's pipeline, and only an admin may quote, win or lose a job
 * — an installer can move work along the bench but cannot change what it is
 * worth or write it off.
 */
export async function advanceOrder(orderId: string, to: OrderStatus) {
  const user = await requireUser();

  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, pipeline: true, status: true },
  });
  if (!order) return { ok: false as const, reason: "That job no longer exists." };

  const check = canTransition(order.pipeline, order.status, to);
  if (!check.ok) return { ok: false as const, reason: check.reason };

  if (user.role !== "ADMIN" && requiresAdmin(to)) {
    return { ok: false as const, reason: "Only an admin can quote, win or lose a job." };
  }

  await db.order.update({
    where: { id: orderId },
    data: {
      status: to,
      ...(to === "WON" ? { wonAt: new Date() } : {}),
      ...(to === "COMPLETE" ? { completedAt: new Date() } : {}),
    },
  });

  revalidatePath("/orders");
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
