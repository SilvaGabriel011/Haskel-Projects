"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/guard";
import { moveOrder } from "@/lib/order-move";
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
 * The rules, the one-winner claim and the stage history live in
 * lib/order-move.ts, where they are tested. This adds who is asking and the
 * page refresh.
 */
export async function advanceOrder(orderId: string, to: OrderStatus) {
  const user = await requireUser();

  const res = await moveOrder({ orderId, to, userId: user.id, role: user.role });
  if (!res.ok) return res;

  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath(`/orders/${orderId}`);
  if (to === "LOST") {
    // Anything the job held went back on the rack.
    revalidatePath("/stock");
    revalidatePath("/offcuts");
  }
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
