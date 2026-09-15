/**
 * Order queries — the third enforcement layer.
 *
 * The route guard (proxy.ts) and the page assertion (lib/guard.ts) stop an
 * employee opening the financials. This stops the money reaching them at all.
 *
 * The mechanism matters: money columns are left out of the Prisma `select` for
 * an employee, so they are never read from the database and never serialised
 * into the payload sent to the browser. This is not redaction after the fact —
 * there is nothing to redact, and nothing to find in devtools.
 *
 * The return type is a union discriminated on role, so a component that reads
 * `quoteCents` off an employee result fails to compile rather than rendering
 * `undefined`.
 */
import type { Prisma, Role } from "@prisma/client";

import { db } from "@/lib/db";

/** Columns every role may see. */
const SHARED_ORDER_SELECT = {
  id: true,
  jobNumber: true,
  pipeline: true,
  jobType: true,
  status: true,
  address: true,
  suburb: true,
  notes: true,
  estimatedHours: true,
  actualHours: true,
  createdAt: true,
  wonAt: true,
  completedAt: true,
  customer: { select: { id: true, name: true, phone: true, suburb: true } },
} satisfies Prisma.OrderSelect;

/** Columns only an admin may see. Money, and why a job was lost. */
const ADMIN_ORDER_SELECT = {
  ...SHARED_ORDER_SELECT,
  quoteCents: true,
  depositCents: true,
  lostReason: true,
} satisfies Prisma.OrderSelect;

export type OrderForEmployee = Prisma.OrderGetPayload<{
  select: typeof SHARED_ORDER_SELECT;
}>;
export type OrderForAdmin = Prisma.OrderGetPayload<{
  select: typeof ADMIN_ORDER_SELECT;
}>;
export type OrderForRole<R extends Role> = R extends "ADMIN"
  ? OrderForAdmin
  : OrderForEmployee;

function selectFor(role: Role) {
  return role === "ADMIN" ? ADMIN_ORDER_SELECT : SHARED_ORDER_SELECT;
}

/** One order, with only the columns this role is allowed to read. */
export async function getOrder<R extends Role>(
  id: string,
  role: R,
): Promise<OrderForRole<R> | null> {
  const order = await db.order.findUnique({
    where: { id },
    select: selectFor(role),
  });
  return order as OrderForRole<R> | null;
}

/** The pipeline board. Employees get the same jobs, minus the money. */
export async function listOrders<R extends Role>(
  role: R,
  where: Prisma.OrderWhereInput = {},
): Promise<OrderForRole<R>[]> {
  const orders = await db.order.findMany({
    where,
    select: selectFor(role),
    orderBy: { createdAt: "desc" },
  });
  return orders as OrderForRole<R>[];
}

/**
 * Admin-only. Revenue and margin across BOTH pipelines, grouped by the shared
 * phase — this is the query that two pipelines would otherwise have cost us.
 */
export async function revenueByMonth(from: Date) {
  return db.order.findMany({
    where: { status: "COMPLETE", completedAt: { gte: from } },
    select: {
      completedAt: true,
      pipeline: true,
      jobType: true,
      quoteCents: true,
      actualHours: true,
      lines: { select: { lineTotalCents: true, offcutId: true, slabId: true } },
    },
    orderBy: { completedAt: "asc" },
  });
}

// --------------------------------------------------------------- the boards

/**
 * One pipeline's board, grouped by stage.
 *
 * Two pipelines means two boards, which is what was asked for — but they read
 * from the same table, so `revenueByMonth` above still sees all of it.
 */
export async function ordersBoard<R extends Role>(role: R, pipeline: Prisma.OrderWhereInput["pipeline"]) {
  const orders = await db.order.findMany({
    where: { pipeline, status: { not: "LOST" } },
    select: selectFor(role),
    orderBy: { createdAt: "desc" },
  });
  return orders as OrderForRole<R>[];
}

/** Counts per pipeline, for the toggle. */
export async function pipelineCounts() {
  const [short, full, lost] = await Promise.all([
    db.order.count({ where: { pipeline: "SHORT", status: { not: "LOST" } } }),
    db.order.count({ where: { pipeline: "FULL", status: { not: "LOST" } } }),
    db.order.count({ where: { status: "LOST" } }),
  ]);
  return { short, full, lost };
}

/*
 * Everything on one job.
 *
 * Written as two explicit selects rather than one with conditional spreads:
 * spreading `...(admin ? {...} : {})` into a Prisma select collapses the
 * inferred type to `unknown`, which loses exactly the compile-time protection
 * this layer exists to provide.
 */

const DETAIL_LINES_SHARED = {
  id: true, description: true, sqm: true, labourHours: true,
  material: { select: { name: true, finish: true, thicknessMm: true } },
  slab: { select: { id: true, ref: true, rack: true } },
  offcut: { select: { id: true, ref: true, rack: true, widthMm: true, lengthMm: true } },
} satisfies Prisma.OrderLineSelect;

const DETAIL_EXTRAS = {
  events: {
    select: {
      id: true, kind: true, startAt: true, endAt: true, address: true,
      assignees: { select: { user: { select: { id: true, name: true } } } },
    },
    orderBy: { startAt: "asc" },
  },
  movements: {
    select: {
      id: true, kind: true, note: true, createdAt: true,
      user: { select: { name: true } },
      slab: { select: { id: true, ref: true } },
      offcut: { select: { id: true, ref: true } },
    },
    orderBy: { createdAt: "desc" },
  },
} satisfies Prisma.OrderSelect;

const DETAIL_ADMIN = {
  ...ADMIN_ORDER_SELECT,
  ...DETAIL_EXTRAS,
  customer: { select: { id: true, name: true, phone: true, suburb: true, email: true, source: true } },
  lines: { select: { ...DETAIL_LINES_SHARED, unitPriceCents: true, lineTotalCents: true } },
} satisfies Prisma.OrderSelect;

const DETAIL_EMPLOYEE = {
  ...SHARED_ORDER_SELECT,
  ...DETAIL_EXTRAS,
  customer: { select: { id: true, name: true, phone: true, suburb: true } },
  lines: { select: DETAIL_LINES_SHARED },
} satisfies Prisma.OrderSelect;

export type OrderDetailAdmin = Prisma.OrderGetPayload<{ select: typeof DETAIL_ADMIN }>;
export type OrderDetailEmployee = Prisma.OrderGetPayload<{ select: typeof DETAIL_EMPLOYEE }>;

export type OrderDetailForRole<R extends Role> = R extends "ADMIN"
  ? OrderDetailAdmin
  : OrderDetailEmployee;

export async function getOrderDetail<R extends Role>(
  id: string,
  role: R,
): Promise<OrderDetailForRole<R> | null> {
  const row =
    role === "ADMIN"
      ? await db.order.findUnique({ where: { id }, select: DETAIL_ADMIN })
      : await db.order.findUnique({ where: { id }, select: DETAIL_EMPLOYEE });
  return row as OrderDetailForRole<R> | null;
}
