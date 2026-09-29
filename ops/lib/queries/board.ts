/**
 * What the follow-up board reads.
 *
 * Same rule as everywhere else: `quoteCents` is left out of the select for an
 * employee, so it is never read and never serialised. lib/board.ts treats an
 * absent quote as "not my business" rather than as zero, so an employee is not
 * shown a money gap they could not fix and would not understand.
 *
 * Settled work is excluded at the database rather than filtered in memory —
 * this board is about what still needs doing, and twelve months of finished
 * jobs is most of the table.
 */
import type { Prisma, Role } from "@prisma/client";

import { toCard, type BoardCard, type JobForBoard } from "@/lib/board";
import { db } from "@/lib/db";

const SHARED = {
  id: true,
  jobNumber: true,
  pipeline: true,
  status: true,
  address: true,
  suburb: true,
  createdAt: true,
  wonAt: true,
  completedAt: true,
  customer: { select: { name: true, phone: true, email: true } },
  _count: { select: { lines: true } },
  // The soonest booking, to spot a date that has come and gone. One row per
  // order, so this stays a single query rather than one per card.
  events: {
    select: { startAt: true },
    orderBy: { startAt: "asc" },
    take: 1,
  },
} satisfies Prisma.OrderSelect;

const ADMIN = { ...SHARED, quoteCents: true } satisfies Prisma.OrderSelect;

/**
 * Every job still in flight, as cards.
 *
 * COMPLETE and LOST are excluded: they are not followed up, and lib/board.ts
 * would score them "ok" anyway.
 */
type SharedRow = Prisma.OrderGetPayload<{ select: typeof SHARED }>;

/** The half of a card that does not depend on role. */
function base(r: SharedRow): Omit<JobForBoard, "quoteCents"> {
  return {
    id: r.id,
    jobNumber: r.jobNumber,
    pipeline: r.pipeline,
    status: r.status,
    address: r.address,
    suburb: r.suburb,
    createdAt: r.createdAt,
    wonAt: r.wonAt,
    completedAt: r.completedAt,
    lineCount: r._count.lines,
    customer: r.customer,
    nextEventAt: r.events[0]?.startAt ?? null,
  };
}

export async function boardCards(role: Role, now = new Date()): Promise<BoardCard[]> {
  const where: Prisma.OrderWhereInput = { status: { notIn: ["COMPLETE", "LOST"] } };
  const orderBy: Prisma.OrderOrderByWithRelationInput = { createdAt: "asc" };

  // Two explicit branches rather than one query and a conditional spread: a
  // spread inside the object collapses quoteCents to `unknown` and takes the
  // compile-time half of the money guard with it.
  if (role === "ADMIN") {
    const rows = await db.order.findMany({ where, orderBy, select: ADMIN });
    return rows.map((r) => toCard({ ...base(r), quoteCents: r.quoteCents }, now));
  }

  const rows = await db.order.findMany({ where, orderBy, select: SHARED });
  // quoteCents is not set at all — absent, not zero. lib/board reads that as
  // "not my business" and raises no money gap.
  return rows.map((r) => toCard(base(r), now));
}
