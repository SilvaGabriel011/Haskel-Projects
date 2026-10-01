/**
 * The lists behind the stone dropdowns: type, colour, thickness, finish.
 *
 * Types are the MaterialKind enum. Colours are the materials on file, so a new
 * colour arrives the same way stone does, through Add stock. Thickness and
 * finish start from the sizes and surfaces the trade actually sells, plus
 * anything already on file, so a material entered as 25 mm still shows up as
 * 25 mm rather than vanishing from its own dropdown.
 */
import type { MaterialKind } from "@prisma/client";

export const STONE_THICKNESSES_MM = [12, 20, 30, 40] as const;

export const STONE_FINISHES = ["Polished", "Honed", "Matte", "Satin", "Low sheen", "Leathered"] as const;

/** The standard thicknesses plus any on file, smallest first, no repeats. */
export function thicknessOptions(onFile: readonly number[] = []): number[] {
  return [...new Set([...STONE_THICKNESSES_MM, ...onFile])]
    .filter((n) => Number.isInteger(n) && n > 0)
    .sort((a, b) => a - b);
}

/** The standard finishes, then any others on file, matched without regard to case. */
export function finishOptions(onFile: readonly string[] = []): string[] {
  const out: string[] = [...STONE_FINISHES];
  const seen = new Set(out.map((f) => f.toLowerCase()));
  for (const raw of onFile) {
    const f = raw.trim();
    if (f && !seen.has(f.toLowerCase())) {
      seen.add(f.toLowerCase());
      out.push(f);
    }
  }
  return out;
}

/** Suppliers already on file, for the supplier dropdown. */
export function supplierOptions(onFile: readonly string[]): string[] {
  return [...new Set(onFile.map((s) => s.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export type StoneMaterial = {
  id: string;
  name: string;
  kind: MaterialKind;
  finish: string;
  thicknessMm: number;
};

/** The colours of one type of stone, for the colour dropdown. */
export function coloursOf<T extends { kind: MaterialKind }>(materials: readonly T[], kind: MaterialKind | ""): T[] {
  return kind ? materials.filter((m) => m.kind === kind) : [];
}

/** How a chosen stone reads on a job: "Calacatta Gold · 20 mm · Polished". */
export function describeStone(m: { name: string }, thicknessMm: number, finish: string): string {
  return [m.name, `${thicknessMm} mm`, finish].filter(Boolean).join(" · ");
}
