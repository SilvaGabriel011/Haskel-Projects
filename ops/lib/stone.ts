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

/**
 * Slab thicknesses the trade sells in Australia, thinnest first: 6 and 8 mm
 * sintered and porcelain for splashbacks and cladding, 12 mm the thin-look
 * benchtop in Dekton and Neolith, 13 and 20 mm engineered stone, 20 and 30 mm
 * the usual benchtop and natural stone, 40 mm natural slabs. Checked October
 * 2026 against Cosentino's Australian Dekton pages (4, 8, 12, 20, 30 mm), an
 * Australian Neolith distributor's brochure (3, 6, 12, 20 mm) and Caesarstone's
 * technical info (13, 20, 30 mm). A thicker-looking edge is built up from a
 * 20 mm slab: that is the edge (EDGE_PROFILES), not the slab.
 */
export const STONE_THICKNESSES_MM = [6, 8, 12, 13, 20, 30, 40] as const;

export const STONE_FINISHES = [
  "Polished",
  "Honed",
  "Matte",
  "Satin",
  "Silk",
  "Low sheen",
  "Leathered",
  "Brushed",
  "Textured",
] as const;

/**
 * How a benchtop's edge is finished, as fabricators in Australia name them.
 * The built-up ones are what makes a 20 mm slab read as 40 or 60 mm: a mitre
 * folds a strip down at 45 degrees so the join all but disappears; a laminate
 * glues a strip under the edge, and the line shows. Optional on a job.
 */
export const EDGE_PROFILES = [
  "Arris (square, eased)",
  "Pencil round",
  "Half round",
  "Bullnose",
  "Bevel",
  "40 mm mitred",
  "60 mm mitred",
  "40 mm laminated",
] as const;

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

/** How a chosen stone reads on a job: "Calacatta Gold · 20 mm · Polished · 40 mm mitred edge". */
export function describeStone(m: { name: string }, thicknessMm: number, finish: string, edge?: string | null): string {
  const e = edge?.trim();
  return [m.name, `${thicknessMm} mm`, finish, e ? (/\bedge\b/i.test(e) ? e : `${e} edge`) : ""]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The choices for a thickness or finish, in two groups: what this colour is
 * made in, first, then everything else the trade sells. Anything else can
 * still be typed in; this is where to start, not a fence.
 */
export function groupedOptions<T extends string | number>(madeIn: readonly T[], all: readonly T[]) {
  const key = (x: T) => String(x).toLowerCase();
  const made = new Set(madeIn.map(key));
  return { madeIn: [...madeIn], others: all.filter((x) => !made.has(key(x))) };
}

/**
 * A stone on no list, typed in on New job: "new:<name>". Named on the job
 * with no material behind it, like a catalogue colour not yet on the rack.
 */
const NEW = "new:";
export const MAX_STONE_NAME = 80;

export const isNewStoneKey = (v: string) => v.startsWith(NEW);

export const newStoneKey = (name: string) => `${NEW}${name.replace(/\s+/g, " ").trim()}`;

/** The name typed for a stone on no list, tidied; empty if it is not usable. */
export function newStoneName(v: string): string {
  if (!isNewStoneKey(v)) return "";
  const name = v.slice(NEW.length).replace(/\s+/g, " ").trim();
  return name.length >= 2 && name.length <= MAX_STONE_NAME ? name : "";
}
