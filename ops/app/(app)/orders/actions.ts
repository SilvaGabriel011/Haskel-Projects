"use server";

import { revalidatePath } from "next/cache";

import { record } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireAdmin, requireUser } from "@/lib/guard";
import { STAGE_LABEL } from "@/lib/pipeline";
import { sendJobNotices, sendStageEmail } from "@/lib/job-notices-send";
import { createJob, validateNewJob } from "@/lib/new-job";
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
  await record(user, "job.moved", `Moved ${await jobNumber(orderId)} to ${STAGE_LABEL[to]}`, `/orders/${orderId}`);

  // The stages the client hears about email them. Never stops the move.
  const mail = await sendStageEmail(orderId, to);
  if (mail.email === "sent") {
    await record(user, "job.emailed", `Emailed the client: ${await jobNumber(orderId)} is ${STAGE_LABEL[to]}`, `/orders/${orderId}`);
  }
  if (mail.detail) console.error(`Stage email for ${orderId}: ${mail.detail}`);

  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath(`/orders/${orderId}`);
  if (to === "LOST") {
    // Anything the job held went back on the rack.
    revalidatePath("/stock");
    revalidatePath("/offcuts");
  }
  return { ok: true as const, email: mail.email };
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
  if (res.ok) {
    await record(user, "stock.reserved", `Held ${await stockRef(kind, itemId)} for ${await jobNumber(orderId)}`, `/orders/${orderId}`);
    revalidateStock(orderId);
  }
  return res;
}

export async function releaseFromOrder(orderId: string, kind: StockKind, itemId: string) {
  const user = await requireUser();
  const res = await releaseStock({ kind, itemId, orderId, userId: user.id });
  if (res.ok) {
    await record(user, "stock.released", `Gave back ${await stockRef(kind, itemId)} from ${await jobNumber(orderId)}`, `/orders/${orderId}`);
    revalidateStock(orderId);
  }
  return res;
}

/** How a job reads in the activity record. */
async function jobNumber(orderId: string) {
  return (await db.order.findUnique({ where: { id: orderId }, select: { jobNumber: true } }))?.jobNumber ?? "a job";
}

async function stockRef(kind: StockKind, id: string) {
  const row =
    kind === "slab"
      ? await db.slab.findUnique({ where: { id }, select: { ref: true } })
      : await db.offcut.findUnique({ where: { id }, select: { ref: true } });
  return row?.ref ?? kind;
}

function revalidateStock(orderId: string) {
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/stock");
  revalidatePath("/offcuts");
}

/**
 * Open a job by hand: the phone call, the builder, the walk-in.
 *
 * Admin only, re-asserted here because a server action is its own endpoint.
 * Choosing the client and the stone is the office's call, like quoting.
 * Rules and writing live in lib/new-job.ts, where they are tested.
 */
export async function openJob(form: Record<string, unknown>) {
  const me = await requireAdmin();

  const parsed = validateNewJob(form);
  if (!parsed.ok) return parsed;

  const res = await createJob(parsed.value, me.id);
  if (!res.ok) return res;
  await record(me, "job.opened", `Opened ${res.jobNumber}`, `/orders/${res.orderId}`);

  // The job is open whatever happens here; the outcome goes to the job page.
  const notices = await sendJobNotices(res.orderId);
  if (notices.email === "sent") {
    await record(me, "job.emailed", `Emailed ${res.jobNumber}'s summary to the client`, `/orders/${res.orderId}`);
  }
  if (notices.detail) console.error(`New job ${res.jobNumber}: ${notices.detail}`);

  revalidatePath("/orders");
  revalidatePath("/board");
  revalidatePath("/dashboard");
  return { ...res, email: notices.email, calendar: notices.calendar };
}
