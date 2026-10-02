/**
 * Putting stock on the rack: the writing half of Add stock.
 *
 * Kept out of the server action so it can be tested without a session, like
 * lib/booking-accept.ts: the action adds the admin check and the page refresh.
 *
 * Every create also writes a RECEIVED movement naming what arrived, so the
 * audit trail on /stock stays complete. tests/seed-integrity.test.ts asserts
 * no movement names nothing; this keeps hand-entered stock to the same bar.
 *
 * All of one addition is one transaction. A new colour used to be saved before
 * the piece, so a piece that then failed left the colour behind, and trying
 * again was refused as a name that already exists.
 */
import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { MATERIAL_KIND_LABEL, nextRef, type StockInput } from "@/lib/stock-input";

export type AddResult = { ok: true; ref: string; href: string } | { ok: false; reason: string };

/** Refs are unique, so two people adding at once can collide. Retry, don't fail. */
const REF_ATTEMPTS = 5;

class Refused extends Error {}

const isUniqueViolation = (e: unknown, field?: string) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2002" &&
  (!field || JSON.stringify(e.meta ?? {}).includes(field));

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/** The material this piece is, either picked from the list or made now. */
async function materialFor(tx: Tx, input: Extract<StockInput, { materialId: string | null }>): Promise<string> {
  if (input.materialId) {
    const found = await tx.material.findUnique({ where: { id: input.materialId }, select: { id: true } });
    if (!found) throw new Refused("That colour is no longer on file. Pick it again.");
    return found.id;
  }
  const m = input.newMaterial!;
  // "calacatta gold" is the Calacatta Gold already on file, not a new colour.
  // Names are unique only as typed, so check without regard to case.
  const same = await tx.material.findFirst({
    where: { name: { equals: m.name, mode: "insensitive" } },
    select: { name: true, kind: true },
  });
  if (same) {
    throw new Refused(
      `${same.name} is already on file, under ${MATERIAL_KIND_LABEL[same.kind]}. Pick it from the colour list.`,
    );
  }
  return (await tx.material.create({ data: m, select: { id: true } })).id;
}

export async function addStock(input: StockInput, userId: string): Promise<AddResult> {
  for (let attempt = 0; attempt < REF_ATTEMPTS; attempt++) {
    try {
      return await db.$transaction(async (tx): Promise<AddResult> => {
        if (input.kind === "CONSUMABLE") {
          const consumable = await tx.consumable.create({
            data: {
              name: input.name,
              unit: input.unit,
              qtyOnHand: input.qtyOnHand,
              reorderPoint: input.reorderPoint,
              unitCostCents: input.unitCostCents,
            },
          });
          await tx.stockMovement.create({
            data: { kind: "RECEIVED", consumableId: consumable.id, qty: input.qtyOnHand, userId, note: "Added by hand" },
          });
          return { ok: true, ref: consumable.name, href: "/stock" };
        }

        const materialId = await materialFor(tx, input);

        if (input.kind === "SLAB") {
          const used = await tx.slab.findMany({ select: { ref: true } });
          const slab = await tx.slab.create({
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
          await tx.stockMovement.create({
            data: { kind: "RECEIVED", slabId: slab.id, userId, note: "Added by hand" },
          });
          return { ok: true, ref: slab.ref, href: `/stock/${slab.id}` };
        }

        // An offcut is the stone of the slab it came off. Linking a Calacatta
        // offcut to a Carrara slab would put it in the wrong slab's history.
        if (input.parentSlabId) {
          const parent = await tx.slab.findUnique({
            where: { id: input.parentSlabId },
            select: { ref: true, materialId: true, material: { select: { name: true } } },
          });
          if (!parent) throw new Refused("That slab is no longer on file. Pick it again.");
          if (parent.materialId !== materialId) {
            throw new Refused(`${parent.ref} is ${parent.material.name}, not this colour. Pick the slab it came off.`);
          }
        }

        const used = await tx.offcut.findMany({ select: { ref: true } });
        const offcut = await tx.offcut.create({
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
        await tx.stockMovement.create({
          data: { kind: "RECEIVED", offcutId: offcut.id, userId, note: "Added by hand" },
        });
        return { ok: true, ref: offcut.ref, href: "/offcuts" };
      });
    } catch (e) {
      if (e instanceof Refused) return { ok: false, reason: e.message };
      // Someone else took that ref between the read and the write. Go again;
      // the whole addition rolled back, the new colour included.
      if (isUniqueViolation(e, "ref") && attempt < REF_ATTEMPTS - 1) continue;
      if (isUniqueViolation(e)) return { ok: false, reason: "Something with that name already exists." };
      throw e;
    }
  }
  return { ok: false, reason: "Could not allocate a reference. Try again." };
}
