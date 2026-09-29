"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { nextRef, validateStock } from "@/lib/stock-input";

/**
 * Putting stock on the rack.
 *
 * Admin only, and re-asserted here rather than leaned on from the page: a
 * server action is its own endpoint and can be called without the modal ever
 * being opened. Every branch either sets a cost or creates a material with a
 * cost per m², which is money, and money is admin-only throughout.
 *
 * Every create also writes a RECEIVED movement naming what arrived, so the
 * audit trail on /stock stays complete. tests/seed-integrity.test.ts asserts
 * no movement names nothing; this keeps hand-entered stock to the same bar.
 */

/** Refs are unique, so two people adding at once can collide. Retry, don't fail. */
const REF_ATTEMPTS = 5;

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002";
}

export async function createStock(form: Record<string, unknown>) {
  const me = await requireAdmin();

  const parsed = validateStock(form);
  if (!parsed.ok) return { ok: false as const, reason: parsed.reason };
  const input = parsed.value;

  try {
    if (input.kind === "CONSUMABLE") {
      const consumable = await db.consumable.create({
        data: {
          name: input.name,
          unit: input.unit,
          qtyOnHand: input.qtyOnHand,
          reorderPoint: input.reorderPoint,
          unitCostCents: input.unitCostCents,
        },
      });
      await db.stockMovement.create({
        data: {
          kind: "RECEIVED",
          consumableId: consumable.id,
          qty: input.qtyOnHand,
          userId: me.id,
          note: "Added by hand",
        },
      });
      revalidatePath("/stock");
      return { ok: true as const, ref: consumable.name, href: "/stock" };
    }

    // Slabs and offcuts both need a material — either one already on file or
    // one being created alongside the piece.
    const materialId =
      input.materialId ??
      (await db.material.create({ data: input.newMaterial! })).id;

    for (let attempt = 0; attempt < REF_ATTEMPTS; attempt++) {
      try {
        if (input.kind === "SLAB") {
          const used = await db.slab.findMany({ select: { ref: true } });
          const slab = await db.slab.create({
            data: {
              ref: nextRef("SLB", used.map((s) => s.ref)),
              materialId,
              widthMm: input.widthMm,
              lengthMm: input.lengthMm,
              rack: input.rack,
              costCents: input.costCents,
              arrivedAt: input.arrivedAt,
            },
          });
          await db.stockMovement.create({
            data: { kind: "RECEIVED", slabId: slab.id, userId: me.id, note: "Added by hand" },
          });
          revalidatePath("/stock");
          return { ok: true as const, ref: slab.ref, href: `/stock/${slab.id}` };
        }

        const used = await db.offcut.findMany({ select: { ref: true } });
        const offcut = await db.offcut.create({
          data: {
            ref: nextRef("OFF", used.map((o) => o.ref)),
            parentSlabId: input.parentSlabId,
            materialId,
            widthMm: input.widthMm,
            lengthMm: input.lengthMm,
            thicknessMm: input.thicknessMm,
            finish: input.finish,
            rack: input.rack,
            listedPublicly: input.listedPublicly,
            notes: input.notes,
          },
        });
        await db.stockMovement.create({
          data: { kind: "RECEIVED", offcutId: offcut.id, userId: me.id, note: "Added by hand" },
        });
        revalidatePath("/stock");
        revalidatePath("/offcuts");
        return { ok: true as const, ref: offcut.ref, href: "/offcuts" };
      } catch (e) {
        if (!isUniqueViolation(e) || attempt === REF_ATTEMPTS - 1) throw e;
        // Someone else took that ref between the read and the write. Go again.
      }
    }

    return { ok: false as const, reason: "Could not allocate a reference. Try again." };
  } catch (e) {
    if (isUniqueViolation(e)) {
      return { ok: false as const, reason: "Something with that name already exists." };
    }
    console.error("[createStock]", e);
    return { ok: false as const, reason: "That did not save. Try again." };
  }
}
