/**
 * Finding a stone by typing, and offering the ones the office picks most.
 *
 * The dropdowns (type → brand → colour) suit someone browsing. On the phone
 * with a client who has just said "Lunar", typing it is quicker, and most jobs
 * are in a handful of colours the office picks again and again. So the New job
 * form also offers one search box over every stone it knows, headed by the
 * ones chosen most recently and most often.
 *
 * A stone not on any list can be typed in and used as it is: "new:<name>".
 * Like a catalogue colour not yet on the rack, it is named on the job with no
 * material behind it, so nothing reads as free stone in Financials.
 *
 * Pure, so it is unit tested and can run in the browser.
 */
import type { MaterialKind } from "@prisma/client";

import { MATERIAL_KIND_LABEL } from "@/lib/stock-input";
import { MAX_STONE_NAME, newStoneKey } from "@/lib/stone";
import {
  ON_FILE_RANGE,
  STONE_CATALOGUE,
  colourOptions,
  fromCatalogueKey,
  isCatalogueKey,
  rangeOptions,
} from "@/lib/stone-catalogue";

export type StoneChoice = {
  /** What the form sends: a material id, "cat:range:colour" or "new:name". */
  value: string;
  /** As the job will name it: "Dekton Lunar". */
  name: string;
  /** Where it comes from, shown under the name: "Sintered · Dekton". */
  hint: string;
  kind: MaterialKind | null;
  /** The brand dropdown's value, so picking here sets the dropdowns too. */
  rangeId: string;
  onFile: boolean;
};

type FileMaterial = { id: string; name: string; kind: MaterialKind; thicknessMm: number; finish: string };

/** Every stone the form can offer: the catalogue, with anything on file in place of its colour, then the rest on file. */
export function allStoneChoices(materials: readonly FileMaterial[]): StoneChoice[] {
  const out: StoneChoice[] = [];
  for (const kind of [...new Set(STONE_CATALOGUE.map((r) => r.kind).concat(materials.map((m) => m.kind)))]) {
    for (const range of rangeOptions(kind, materials)) {
      for (const c of colourOptions(kind, range.value, materials)) {
        const cat = range.value === ON_FILE_RANGE ? null : STONE_CATALOGUE.find((r) => r.id === range.value);
        const onFileName = materials.find((m) => m.id === c.value)?.name;
        const name = onFileName ?? (isCatalogueKey(c.value) ? fromCatalogueKey(c.value)?.fullName : null) ?? c.label;
        out.push({
          value: c.value,
          name,
          hint: [MATERIAL_KIND_LABEL[kind], cat ? cat.label : "On file", c.onFile && cat ? "on file" : ""]
            .filter(Boolean)
            .join(" · "),
          kind,
          rangeId: range.value,
          onFile: c.onFile,
        });
      }
    }
  }
  return out;
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/**
 * The stones matching what was typed, best first. Every word typed must
 * appear somewhere in the name or where it comes from, in any order, so
 * "lunar dek" and "dekton lunar" both find Dekton Lunar. A name that starts
 * with what was typed comes before one that only contains it.
 */
export function searchStones(choices: readonly StoneChoice[], query: string, limit = 8): StoneChoice[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const q = words.join(" ");
  const scored: Array<{ c: StoneChoice; score: number; i: number }> = [];
  choices.forEach((c, i) => {
    const name = fold(c.name);
    const hay = `${name} ${fold(c.hint)}`;
    if (!words.every((w) => hay.includes(w))) return;
    // The colour alone, without the brand: "Lunar" for "Dekton Lunar".
    const bare = name.split(" ").slice(1).join(" ");
    const score = name.startsWith(q) || bare.startsWith(q) ? 0 : words.every((w) => name.includes(w)) ? 1 : 2;
    scored.push({ c, score, i });
  });
  return scored
    .sort((a, b) => a.score - b.score || (a.c.onFile === b.c.onFile ? 0 : a.c.onFile ? -1 : 1) || a.i - b.i)
    .slice(0, limit)
    .map((s) => s.c);
}

/** True when nothing on the list is called exactly this, so it is worth offering to add it. */
export function canAddStone(choices: readonly StoneChoice[], typed: string): boolean {
  const name = typed.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > MAX_STONE_NAME) return false;
  const f = fold(name);
  return !choices.some((c) => fold(c.name) === f || fold(c.name.split(" ").slice(1).join(" ")) === f);
}

/** A stone line on a past job: what it was linked to, how it was described, when. */
export type PastStoneLine = { materialId: string | null; description: string; at: Date };

/**
 * The stone a past line names, as a choice the form can offer again. Linked
 * to a material: that material. Otherwise the name New job wrote before the
 * first " · " ("Dekton Lunar · 20 mm · Matte"), matched back to the list, or
 * offered as the typed stone it was.
 */
function choiceForLine(line: PastStoneLine, choices: readonly StoneChoice[]): StoneChoice | null {
  if (line.materialId) return choices.find((c) => c.value === line.materialId) ?? null;
  if (!line.description.includes(" · ")) return null;
  const name = line.description.split(" · ")[0].trim();
  const f = fold(name);
  const known = choices.find((c) => fold(c.name) === f);
  if (known) return known;
  if (name.length < 2 || name.length > MAX_STONE_NAME) return null;
  return { value: newStoneKey(name), name, hint: "Typed in on an earlier job", kind: null, rangeId: "", onFile: false };
}

/**
 * The stones picked most recently, and most often, on past jobs. Each list
 * has no repeats; "most chosen" leaves out stones picked only once, which
 * are not a habit yet, and ties go to the one picked more recently.
 */
export function chosenStones(lines: readonly PastStoneLine[], choices: readonly StoneChoice[], limit = 5) {
  const seen = new Map<string, { c: StoneChoice; count: number; last: number }>();
  for (const line of lines) {
    const c = choiceForLine(line, choices);
    if (!c) continue;
    const t = line.at.getTime();
    const s = seen.get(c.value);
    if (s) {
      s.count++;
      s.last = Math.max(s.last, t);
    } else seen.set(c.value, { c, count: 1, last: t });
  }
  const all = [...seen.values()];
  return {
    recent: [...all].sort((a, b) => b.last - a.last).slice(0, limit).map((s) => s.c),
    most: all
      .filter((s) => s.count > 1)
      .sort((a, b) => b.count - a.count || b.last - a.last)
      .slice(0, limit)
      .map((s) => ({ ...s.c, count: s.count })),
  };
}
