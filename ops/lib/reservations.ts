/**
 * Holding a slab or an offcut for a job.
 *
 * Unlike a clash in the diary, this one is a refusal, not a warning: one
 * physical offcut cannot go to two jobs, so there is nothing to confirm.
 *
 * The reservation is a single conditional write, "mark RESERVED where still
 * free", so two people reserving the same piece at the same moment cannot both
 * win. The loser is told which job holds it. Every reserve and release writes a
 * StockMovement, which is also how "held by which job" is answered.
 */
import { db } from "@/lib/db";

export type StockKind = "offcut" | "slab";

export type ReserveResult =
  | { ok: true }
  | { ok: false; reason: string; heldBy?: { orderId: string; jobNumber: string } | null };

/** Which job last reserved this piece, from the movement log. */
export async function heldBy(kind: StockKind, itemId: string) {
  const m = await db.stockMovement.findFirst({
    where: { kind: "RESERVED", ...(kind === "offcut" ? { offcutId: itemId } : { slabId: itemId }), orderId: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { order: { select: { id: true, jobNumber: true } } },
  });
  return m?.order ? { orderId: m.order.id, jobNumber: m.order.jobNumber } : null;
}

export async function reserveStock(input: {
  kind: StockKind;
  itemId: string;
  orderId: string;
  userId: string;
}): Promise<ReserveResult> {
  const order = await db.order.findUnique({ where: { id: input.orderId }, select: { status: true } });
  if (!order) return { ok: false, reason: "That job no longer exists." };
  if (order.status === "COMPLETE" || order.status === "LOST") {
    return { ok: false, reason: "That job is closed; stock cannot be held for it." };
  }

  const claimed = await db.$transaction(async (tx) => {
    const res =
      input.kind === "offcut"
        ? await tx.offcut.updateMany({ where: { id: input.itemId, status: "AVAILABLE" }, data: { status: "RESERVED" } })
        : await tx.slab.updateMany({ where: { id: input.itemId, status: "IN_STOCK" }, data: { status: "RESERVED" } });
    if (res.count === 0) return false;
    await tx.stockMovement.create({
      data: {
        kind: "RESERVED",
        ...(input.kind === "offcut" ? { offcutId: input.itemId } : { slabId: input.itemId }),
        orderId: input.orderId,
        userId: input.userId,
      },
    });
    return true;
  });
  if (claimed) return { ok: true };

  // Lost, or it was never free. Say which, and who has it.
  const current =
    input.kind === "offcut"
      ? await db.offcut.findUnique({ where: { id: input.itemId }, select: { status: true, ref: true } })
      : await db.slab.findUnique({ where: { id: input.itemId }, select: { status: true, ref: true } });
  if (!current) return { ok: false, reason: "That piece no longer exists." };
  if (current.status === "RESERVED") {
    const holder = await heldBy(input.kind, input.itemId);
    if (holder?.orderId === input.orderId) return { ok: false, reason: `${current.ref} is already held for this job.`, heldBy: holder };
    return {
      ok: false,
      reason: holder ? `${current.ref} is already held for ${holder.jobNumber}.` : `${current.ref} is already reserved.`,
      heldBy: holder,
    };
  }
  return { ok: false, reason: `${current.ref} is ${current.status.toLowerCase().replace(/_/g, " ")}, not available.` };
}

/** Put a held piece back. Only the job holding it can release it. */
export async function releaseStock(input: {
  kind: StockKind;
  itemId: string;
  orderId: string;
  userId: string;
}): Promise<ReserveResult> {
  const holder = await heldBy(input.kind, input.itemId);
  if (!holder || holder.orderId !== input.orderId) {
    return { ok: false, reason: "This job is not holding that piece.", heldBy: holder };
  }

  const released = await db.$transaction(async (tx) => {
    const res =
      input.kind === "offcut"
        ? await tx.offcut.updateMany({ where: { id: input.itemId, status: "RESERVED" }, data: { status: "AVAILABLE" } })
        : await tx.slab.updateMany({ where: { id: input.itemId, status: "RESERVED" }, data: { status: "IN_STOCK" } });
    if (res.count === 0) return false;
    await tx.stockMovement.create({
      data: {
        kind: "RELEASED",
        ...(input.kind === "offcut" ? { offcutId: input.itemId } : { slabId: input.itemId }),
        orderId: input.orderId,
        userId: input.userId,
      },
    });
    return true;
  });
  return released ? { ok: true } : { ok: false, reason: "That piece is no longer reserved." };
}

/** Pieces a job can take right now, without cost fields (employees reserve too). */
export async function availableStock() {
  const [offcuts, slabs] = await Promise.all([
    db.offcut.findMany({
      where: { status: "AVAILABLE" },
      select: { id: true, ref: true, widthMm: true, lengthMm: true, rack: true, material: { select: { name: true } } },
      orderBy: { ref: "asc" },
    }),
    db.slab.findMany({
      where: { status: "IN_STOCK" },
      select: { id: true, ref: true, widthMm: true, lengthMm: true, rack: true, material: { select: { name: true } } },
      orderBy: { ref: "asc" },
    }),
  ]);
  return { offcuts, slabs };
}

/** What this job currently holds: reserved pieces whose latest reservation is this job's. */
export async function heldForOrder(orderId: string) {
  const reservedHere = await db.stockMovement.findMany({
    where: { orderId, kind: "RESERVED" },
    select: { offcutId: true, slabId: true },
  });
  const offcutIds = [...new Set(reservedHere.flatMap((m) => (m.offcutId ? [m.offcutId] : [])))];
  const slabIds = [...new Set(reservedHere.flatMap((m) => (m.slabId ? [m.slabId] : [])))];

  const [offcuts, slabs] = await Promise.all([
    db.offcut.findMany({ where: { id: { in: offcutIds }, status: "RESERVED" }, select: { id: true, ref: true, rack: true } }),
    db.slab.findMany({ where: { id: { in: slabIds }, status: "RESERVED" }, select: { id: true, ref: true, rack: true } }),
  ]);

  const mine = async (kind: StockKind, id: string) => (await heldBy(kind, id))?.orderId === orderId;
  return {
    offcuts: (await Promise.all(offcuts.map(async (o) => ((await mine("offcut", o.id)) ? o : null)))).filter((o) => o !== null),
    slabs: (await Promise.all(slabs.map(async (s) => ((await mine("slab", s.id)) ? s : null)))).filter((s) => s !== null),
  };
}
