/**
 * Stock queries, role-aware.
 *
 * Same rule as orders: cost columns are left out of the `select` for an
 * employee, so they are never read and never serialised. An installer needs to
 * know which slab, what size and which rack — not what it cost.
 */
import type { OffcutStatus, Prisma, Role, SlabStatus } from "@prisma/client";

import { db } from "@/lib/db";

const isAdmin = (role: Role) => role === "ADMIN";

// ----------------------------------------------------------------- slabs

const SLAB_SHARED = {
  id: true,
  ref: true,
  widthMm: true,
  lengthMm: true,
  status: true,
  rack: true,
  arrivedAt: true,
  photoUrl: true,
  material: { select: { id: true, name: true, kind: true, finish: true, thicknessMm: true } },
  _count: { select: { offcuts: true } },
} satisfies Prisma.SlabSelect;

const SLAB_ADMIN = {
  ...SLAB_SHARED,
  costCents: true,
  material: {
    select: { id: true, name: true, kind: true, finish: true, thicknessMm: true, costPerSqmCents: true, supplier: true },
  },
} satisfies Prisma.SlabSelect;

export type SlabForEmployee = Prisma.SlabGetPayload<{ select: typeof SLAB_SHARED }>;
export type SlabForAdmin = Prisma.SlabGetPayload<{ select: typeof SLAB_ADMIN }>;
export type SlabForRole<R extends Role> = R extends "ADMIN" ? SlabForAdmin : SlabForEmployee;

export type SlabFilters = { status?: SlabStatus; materialId?: string; q?: string };

export async function listSlabs<R extends Role>(role: R, filters: SlabFilters = {}) {
  const where: Prisma.SlabWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.materialId) where.materialId = filters.materialId;
  if (filters.q) {
    where.OR = [
      { ref: { contains: filters.q, mode: "insensitive" } },
      { rack: { contains: filters.q, mode: "insensitive" } },
      { material: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  const rows = await db.slab.findMany({
    where,
    select: isAdmin(role) ? SLAB_ADMIN : SLAB_SHARED,
    orderBy: [{ status: "asc" }, { ref: "asc" }],
  });
  return rows as SlabForRole<R>[];
}

export async function getSlab<R extends Role>(id: string, role: R) {
  const slab = await db.slab.findUnique({
    where: { id },
    select: {
      ...(isAdmin(role) ? SLAB_ADMIN : SLAB_SHARED),
      offcuts: {
        select: {
          id: true, ref: true, widthMm: true, lengthMm: true, thicknessMm: true,
          finish: true, status: true, rack: true, listedPublicly: true,
        },
        orderBy: { ref: "asc" },
      },
      movements: {
        select: {
          id: true, kind: true, qty: true, note: true, createdAt: true,
          user: { select: { name: true } },
          order: { select: { id: true, jobNumber: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 25,
      },
    },
  });
  return slab as (SlabForRole<R> & {
    offcuts: Array<{ id: string; ref: string; widthMm: number; lengthMm: number; thicknessMm: number; finish: string; status: OffcutStatus; rack: string; listedPublicly: boolean }>;
    movements: Array<{ id: string; kind: string; qty: number; note: string | null; createdAt: Date; user: { name: string }; order: { id: string; jobNumber: string } | null }>;
  }) | null;
}

// --------------------------------------------------------------- offcuts

const OFFCUT_SELECT = {
  id: true,
  ref: true,
  widthMm: true,
  lengthMm: true,
  thicknessMm: true,
  finish: true,
  status: true,
  rack: true,
  listedPublicly: true,
  notes: true,
  createdAt: true,
  material: { select: { id: true, name: true, kind: true } },
  parentSlab: { select: { id: true, ref: true } },
} satisfies Prisma.OffcutSelect;

export type Offcut = Prisma.OffcutGetPayload<{ select: typeof OFFCUT_SELECT }>;
export type OffcutFilters = { status?: OffcutStatus; materialId?: string; listedOnly?: boolean; q?: string };

/**
 * Offcuts carry no cost column of their own, so both roles see the same row.
 * Their value is derived from the parent slab, which is admin-only territory
 * and lives in stockValue() below.
 */
export async function listOffcuts(filters: OffcutFilters = {}): Promise<Offcut[]> {
  const where: Prisma.OffcutWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.materialId) where.materialId = filters.materialId;
  if (filters.listedOnly) where.listedPublicly = true;
  if (filters.q) {
    where.OR = [
      { ref: { contains: filters.q, mode: "insensitive" } },
      { rack: { contains: filters.q, mode: "insensitive" } },
      { material: { name: { contains: filters.q, mode: "insensitive" } } },
    ];
  }
  return db.offcut.findMany({
    where,
    select: OFFCUT_SELECT,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

// ----------------------------------------------------------- consumables

const CONSUMABLE_SHARED = {
  id: true, name: true, unit: true, qtyOnHand: true, reorderPoint: true,
} satisfies Prisma.ConsumableSelect;

const CONSUMABLE_ADMIN = { ...CONSUMABLE_SHARED, unitCostCents: true } satisfies Prisma.ConsumableSelect;

export type ConsumableForEmployee = Prisma.ConsumableGetPayload<{ select: typeof CONSUMABLE_SHARED }>;
export type ConsumableForAdmin = Prisma.ConsumableGetPayload<{ select: typeof CONSUMABLE_ADMIN }>;
export type ConsumableForRole<R extends Role> = R extends "ADMIN" ? ConsumableForAdmin : ConsumableForEmployee;

export async function listConsumables<R extends Role>(role: R) {
  const rows = await db.consumable.findMany({
    select: isAdmin(role) ? CONSUMABLE_ADMIN : CONSUMABLE_SHARED,
    orderBy: { name: "asc" },
  });
  return rows as ConsumableForRole<R>[];
}

/** Anything at or below its reorder point. Both roles — running out is everyone's problem. */
export async function lowStockConsumables() {
  const all = await db.consumable.findMany({
    select: { id: true, name: true, unit: true, qtyOnHand: true, reorderPoint: true },
    orderBy: { name: "asc" },
  });
  return all.filter((c) => c.qtyOnHand <= c.reorderPoint);
}

// ------------------------------------------------------------ headline numbers

export async function stockCounts() {
  const [slabsInStock, slabsReserved, offcutsAvailable, offcutsListed, lowStock] = await Promise.all([
    db.slab.count({ where: { status: "IN_STOCK" } }),
    db.slab.count({ where: { status: "RESERVED" } }),
    db.offcut.count({ where: { status: "AVAILABLE" } }),
    db.offcut.count({ where: { listedPublicly: true } }),
    lowStockConsumables().then((r) => r.length),
  ]);
  return { slabsInStock, slabsReserved, offcutsAvailable, offcutsListed, lowStock };
}

/** ADMIN ONLY. Never call this from a page an employee can open. */
export async function stockValueCents(): Promise<number> {
  const agg = await db.slab.aggregate({
    where: { status: { in: ["IN_STOCK", "RESERVED"] } },
    _sum: { costCents: true },
  });
  return agg._sum.costCents ?? 0;
}

/** Recent movement across everything, for the stock overview. */
export async function recentMovements(take = 12) {
  return db.stockMovement.findMany({
    select: {
      id: true, kind: true, qty: true, note: true, createdAt: true,
      user: { select: { name: true } },
      slab: { select: { ref: true } },
      offcut: { select: { ref: true } },
      consumable: { select: { name: true } },
      order: { select: { id: true, jobNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take,
  });
}
