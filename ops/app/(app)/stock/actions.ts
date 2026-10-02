"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/guard";
import { addStock } from "@/lib/stock-create";
import { validateStock } from "@/lib/stock-input";

/**
 * Putting stock on the rack.
 *
 * Admin only, and re-asserted here rather than leaned on from the page: a
 * server action is its own endpoint and can be called without the modal ever
 * being opened. Every branch either sets a cost or creates a material with a
 * cost per m², which is money, and money is admin-only throughout.
 *
 * The writing, and the checks that need the database, are in lib/stock-create.ts.
 */
export async function createStock(form: Record<string, unknown>) {
  const me = await requireAdmin();

  const parsed = validateStock(form);
  if (!parsed.ok) return { ok: false as const, reason: parsed.reason };

  try {
    const result = await addStock(parsed.value, me.id);
    if (result.ok) {
      revalidatePath("/stock");
      if (parsed.value.kind === "OFFCUT") revalidatePath("/offcuts");
    }
    return result;
  } catch (e) {
    console.error("[createStock]", e);
    return { ok: false as const, reason: "That did not save. Try again." };
  }
}
