/**
 * Validation for adding stock by hand.
 *
 * Pure and free of the database, so every rule here is unit tested rather than
 * only exercised by clicking through the modal. The server action in
 * app/(app)/stock/actions.ts calls this before it writes anything.
 *
 * The browser validates too, but that is a convenience. A server action is its
 * own endpoint and can be invoked without ever loading the form, so these
 * checks are the real ones.
 */
import type { MaterialKind } from "@prisma/client";

import { zonedTime } from "@/lib/business-time";

export const STOCK_KINDS = ["SLAB", "OFFCUT", "CONSUMABLE"] as const;
export type StockKind = (typeof STOCK_KINDS)[number];

export const MATERIAL_KINDS: readonly MaterialKind[] = ["ENGINEERED", "NATURAL", "SINTERED"] as const;

export const MATERIAL_KIND_LABEL: Record<MaterialKind, string> = {
  ENGINEERED: "Engineered",
  NATURAL: "Natural stone",
  SINTERED: "Sintered",
};

export const STOCK_KIND_LABEL: Record<StockKind, string> = {
  SLAB: "A slab",
  OFFCUT: "An offcut",
  CONSUMABLE: "A consumable",
};

export const STOCK_KIND_BLURB: Record<StockKind, string> = {
  SLAB: "A full sheet off the truck, going on the rack.",
  OFFCUT: "A remnant left over from a slab, worth keeping.",
  CONSUMABLE: "Adhesive, blades, sealer — anything you run out of.",
};

/**
 * Bounds. These are not arbitrary: a slab longer than 4 metres does not exist,
 * and a typo of one extra zero on a cost is the mistake worth catching, since
 * it flows straight into the stock value and every margin figure.
 */
const LIMIT = {
  nameLen: 80,
  supplierLen: 80,
  finishLen: 40,
  rackLen: 20,
  unitLen: 20,
  notesLen: 500,
  dimMm: { min: 10, max: 4200 },
  thicknessMm: { min: 3, max: 100 },
  costCents: { min: 0, max: 5_000_000 }, // $50,000
  perSqmCents: { min: 100, max: 1_000_000 }, // $1 – $10,000 per m²
  qty: { min: 0, max: 100_000 },
} as const;

export type NewMaterial = {
  name: string;
  kind: MaterialKind;
  supplier: string;
  thicknessMm: number;
  finish: string;
  costPerSqmCents: number;
};

export type StockInput =
  | {
      kind: "SLAB";
      materialId: string | null;
      newMaterial: NewMaterial | null;
      widthMm: number;
      lengthMm: number;
      rack: string;
      costCents: number;
      arrivedAt: Date;
    }
  | {
      kind: "OFFCUT";
      materialId: string | null;
      newMaterial: NewMaterial | null;
      parentSlabId: string | null;
      widthMm: number;
      lengthMm: number;
      thicknessMm: number;
      finish: string;
      rack: string;
      listedPublicly: boolean;
      notes: string | null;
    }
  | {
      kind: "CONSUMABLE";
      name: string;
      unit: string;
      qtyOnHand: number;
      reorderPoint: number;
      unitCostCents: number;
    };

export type Validated = { ok: true; value: StockInput } | { ok: false; reason: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const bool = (v: unknown) => v === true || v === "true" || v === "on";

/** A whole number within bounds, or null. Rejects "12.5", "1e3" and blanks. */
function int(v: unknown, { min, max }: { min: number; max: number }): number | null {
  const raw = typeof v === "number" ? String(v) : str(v);
  if (!/^-?\d+$/.test(raw)) return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n < min || n > max) return null;
  return n;
}

/**
 * Dollars as typed by a person, to integer cents.
 *
 * Accepts "1200", "1200.50", "$1,200.50". Rejects anything with more than two
 * decimal places rather than rounding it silently — if someone types 10.005
 * they have made a mistake worth showing them, not worth guessing at.
 */
export function dollarsToCents(
  v: unknown,
  bounds: { min: number; max: number } = LIMIT.costCents,
): number | null {
  const raw = str(v).replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
  const cents = Math.round(Number(raw) * 100);
  if (!Number.isSafeInteger(cents) || cents < bounds.min || cents > bounds.max) return null;
  return cents;
}

/** A capped, non-empty string. */
function text(v: unknown, max: number): string | null {
  const s = str(v);
  if (!s || s.length > max) return null;
  return s;
}

function validateNewMaterial(f: Record<string, unknown>): NewMaterial | string {
  const name = text(f.materialName, LIMIT.nameLen);
  if (!name) return "Give the material a name.";

  const kind = MATERIAL_KINDS.find((k) => k === str(f.materialKind));
  if (!kind) return "Pick what kind of material it is.";

  const supplier = text(f.materialSupplier, LIMIT.supplierLen);
  if (!supplier) return "Say who supplies it.";

  const finish = text(f.materialFinish, LIMIT.finishLen);
  if (!finish) return "Give the finish, such as Polished or Matte.";

  const thicknessMm = int(f.materialThicknessMm, LIMIT.thicknessMm);
  if (thicknessMm === null) {
    return `Thickness must be a whole number between ${LIMIT.thicknessMm.min} and ${LIMIT.thicknessMm.max} mm.`;
  }

  const costPerSqmCents = dollarsToCents(f.materialCostPerSqm, LIMIT.perSqmCents);
  if (costPerSqmCents === null) return "Cost per m² does not look like an amount.";

  return { name, kind, supplier, thicknessMm, finish, costPerSqmCents };
}

/** Either an existing material id or a complete new one — never both, never neither. */
function resolveMaterial(
  f: Record<string, unknown>,
): { materialId: string | null; newMaterial: NewMaterial | null } | string {
  const materialId = str(f.materialId);
  if (materialId) return { materialId, newMaterial: null };

  const made = validateNewMaterial(f);
  if (typeof made === "string") return made;
  return { materialId: null, newMaterial: made };
}

function validateDims(f: Record<string, unknown>): { widthMm: number; lengthMm: number } | string {
  const widthMm = int(f.widthMm, LIMIT.dimMm);
  const lengthMm = int(f.lengthMm, LIMIT.dimMm);
  if (widthMm === null || lengthMm === null) {
    return `Width and length must be whole millimetres between ${LIMIT.dimMm.min} and ${LIMIT.dimMm.max}.`;
  }
  return { widthMm, lengthMm };
}

/**
 * A date that is a real day and not years out. Stock arrives now, not in 2031.
 *
 * Read as midnight on the business's calendar, not the server's: the server
 * runs in UTC. And a day that does not exist is refused rather than rolled
 * over — Date reads "2026-02-30" as 2 March without complaint.
 */
function validateArrived(v: unknown, now: Date): Date | string {
  const raw = str(v);
  if (!raw) return "Pick the day it arrived.";
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "That date did not make sense.";
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return "That date did not make sense.";
  }
  const d = zonedTime(year, month, day);
  const tenYears = 3650 * 86_400_000;
  if (d.getTime() > now.getTime() + 86_400_000) return "That date is in the future.";
  if (d.getTime() < now.getTime() - tenYears) return "That date is too far back.";
  return d;
}

export function validateStock(f: Record<string, unknown>, now = new Date()): Validated {
  const kind = STOCK_KINDS.find((k) => k === str(f.kind));
  if (!kind) return { ok: false, reason: "Pick what you are adding." };

  if (kind === "CONSUMABLE") {
    const name = text(f.name, LIMIT.nameLen);
    if (!name) return { ok: false, reason: "Give it a name." };

    const unit = text(f.unit, LIMIT.unitLen);
    if (!unit) return { ok: false, reason: "Say what it is counted in — tubes, blades, litres." };

    const qtyOnHand = int(f.qtyOnHand, LIMIT.qty);
    if (qtyOnHand === null) return { ok: false, reason: "How many do you have? Whole numbers only." };

    const reorderPoint = int(f.reorderPoint, LIMIT.qty);
    if (reorderPoint === null) return { ok: false, reason: "Set the level you want to reorder at." };

    const unitCostCents = dollarsToCents(f.unitCost);
    if (unitCostCents === null) return { ok: false, reason: "Unit cost does not look like an amount." };

    return { ok: true, value: { kind, name, unit, qtyOnHand, reorderPoint, unitCostCents } };
  }

  const material = resolveMaterial(f);
  if (typeof material === "string") return { ok: false, reason: material };

  const dims = validateDims(f);
  if (typeof dims === "string") return { ok: false, reason: dims };

  const rack = text(f.rack, LIMIT.rackLen);
  if (!rack) return { ok: false, reason: "Where is it going? Give a rack or bay." };

  if (kind === "SLAB") {
    const costCents = dollarsToCents(f.cost);
    if (costCents === null) return { ok: false, reason: "Cost does not look like an amount." };

    const arrivedAt = validateArrived(f.arrivedAt, now);
    if (typeof arrivedAt === "string") return { ok: false, reason: arrivedAt };

    return {
      ok: true,
      value: { kind, ...material, ...dims, rack, costCents, arrivedAt },
    };
  }

  // OFFCUT. It carries no cost of its own: what it is worth follows from the
  // material and the slab it came off, so there is no figure to type in wrong.
  const thicknessMm = int(f.thicknessMm, LIMIT.thicknessMm);
  if (thicknessMm === null) {
    return {
      ok: false,
      reason: `Thickness must be a whole number between ${LIMIT.thicknessMm.min} and ${LIMIT.thicknessMm.max} mm.`,
    };
  }

  const finish = text(f.finish, LIMIT.finishLen);
  if (!finish) return { ok: false, reason: "Give the finish, such as Polished or Matte." };

  const notes = str(f.notes);
  if (notes.length > LIMIT.notesLen) return { ok: false, reason: "That note is too long." };

  return {
    ok: true,
    value: {
      kind,
      ...material,
      parentSlabId: str(f.parentSlabId) || null,
      ...dims,
      thicknessMm,
      finish,
      rack,
      listedPublicly: bool(f.listedPublicly),
      notes: notes || null,
    },
  };
}

/**
 * The next reference in a series, from the ones already used.
 *
 * Takes the highest number in use rather than the count, so deleting SLB-0003
 * can never hand its number to a different slab later. Refs are what people
 * write on the stone itself, so reuse would be worse than a gap.
 */
export function nextRef(prefix: string, existing: readonly string[]): string {
  const pattern = new RegExp(`^${prefix}-(\\d+)$`);
  let highest = 0;
  for (const ref of existing) {
    const n = Number(pattern.exec(ref)?.[1]);
    if (Number.isFinite(n) && n > highest) highest = n;
  }
  return `${prefix}-${String(highest + 1).padStart(4, "0")}`;
}
