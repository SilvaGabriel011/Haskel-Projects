/**
 * The stone the trade sells, so a job can name its stone before any of it is
 * on the rack.
 *
 * Colours on file only arrive through Add stock, so a shop with nothing on
 * the rack had nothing to pick. This is the rest: the ranges stonemasons in
 * Australia quote from, each colour with the thicknesses and finishes it is
 * actually made in, so each dropdown only offers what the one before allows.
 *
 * Engineered stone over 1% crystalline silica has been banned in Australia
 * since 1 July 2024, so "Engineered" lists only the crystalline silica-free
 * mineral surfaces that replaced it. Porcelain and sintered stone are exempt.
 *
 * Sources, checked October 2026: caesarstone.com.au (colour pages give 20 mm,
 * Polished, or Rough for the concrete looks; 13 and 30 mm exist overseas on
 * selected colours only), cosentino.com/en-au (Dekton in 4, 8, 12, 20 and
 * 30 mm, not every colour in every one; 4 mm is for furniture, so it is left
 * out here), an Australian Neolith distributor's brochure (3, 6, 12 and 20 mm;
 * 3 mm is cladding, left out) and neolith.com (finish per colour). Natural
 * stone is by stone, not by brand: 20 and 30 mm slabs, polished, honed or
 * leathered.
 *
 * These are what a colour is MADE in, offered first. They are not a fence:
 * the forms also offer every other size and finish the trade sells
 * (lib/stone.ts), and take one typed in, flagging it as off the maker's list
 * rather than refusing it. Ranges change, and the office knows its suppliers.
 */
import type { MaterialKind } from "@prisma/client";

import { finishOptions, isNewStoneKey, newStoneName, thicknessOptions } from "@/lib/stone";

export type CatalogueColour = {
  name: string;
  /** Overrides the range's, where this colour is made in fewer. */
  thicknesses?: readonly number[];
  finishes?: readonly string[];
};

export type CatalogueRange = {
  id: string;
  kind: MaterialKind;
  /** As the dropdown shows it. */
  label: string;
  /** The supplier for a material made from it in Add stock. */
  supplier: string;
  /** How one of its colours reads on a job: "Caesarstone Calacatta Nuvo". */
  fullName: (colour: string) => string;
  thicknesses: readonly number[];
  finishes: readonly string[];
  colours: readonly CatalogueColour[];
};

const CS_ROUGH = { finishes: ["Rough"] } as const;
const DK_TEXTURED = { finishes: ["Textured"] } as const;
const DK_VELVET = { finishes: ["Velvet"] } as const;

export const STONE_CATALOGUE: readonly CatalogueRange[] = [
  {
    id: "caesarstone-mineral",
    kind: "ENGINEERED",
    label: "Caesarstone Mineral (silica-free)",
    supplier: "Caesarstone",
    fullName: (c) => `Caesarstone ${c}`,
    thicknesses: [20],
    finishes: ["Polished"],
    colours: [
      { name: "Airy Concrete", ...CS_ROUGH },
      { name: "Alpine Mist" },
      { name: "Attera Blanca" },
      { name: "Bianco Drift" },
      { name: "Black Tempal" },
      { name: "Brillianza" },
      { name: "Calacatta Dreamwave" },
      { name: "Calacatta Lacebound" },
      { name: "Calacatta Nuvo" },
      { name: "Cloudburst Concrete", ...CS_ROUGH },
      { name: "Cosmopolitan White" },
      { name: "Dreamy Carrara" },
      { name: "Empira White" },
      { name: "Fresh Concrete", ...CS_ROUGH },
      { name: "Frosty Carrina" },
      { name: "Georgian Bluffs" },
      { name: "Glacier Flow" },
      { name: "Intense White" },
      { name: "Jet Black" },
      { name: "Laceline" },
      { name: "Lightcrest" },
      { name: "Misty River" },
      { name: "Organic White" },
      { name: "Osprey" },
      { name: "Pure White" },
      { name: "Raw Concrete", ...CS_ROUGH },
      { name: "Rossa Nova" },
      { name: "Rugged Concrete", ...CS_ROUGH },
      { name: "Snow" },
      { name: "Solenna" },
      { name: "Statuario Maximus" },
      { name: "Symphony Grey" },
      { name: "White Attica" },
    ],
  },
  {
    id: "dekton",
    kind: "SINTERED",
    label: "Dekton",
    supplier: "Cosentino",
    fullName: (c) => `Dekton ${c}`,
    thicknesses: [8, 12, 20, 30],
    finishes: ["Matte"],
    colours: [
      { name: "Adia" },
      { name: "Aeris" },
      { name: "Albarium" },
      { name: "Argentium" },
      { name: "Aura 22" },
      { name: "Ava" },
      { name: "Bromo", ...DK_TEXTURED },
      { name: "Danae" },
      { name: "Domoos" },
      { name: "Eter" },
      { name: "Grafite" },
      { name: "Grigio" },
      { name: "Keon" },
      { name: "Kira" },
      { name: "Kovik" },
      { name: "Kreta" },
      { name: "Laos" },
      { name: "Lunar" },
      { name: "Moone" },
      { name: "Nacre", ...DK_VELVET },
      { name: "Nebbia" },
      { name: "Nebu" },
      { name: "Sabbia" },
      { name: "Sirius", ...DK_TEXTURED },
      { name: "Umber" },
    ],
  },
  {
    id: "neolith",
    kind: "SINTERED",
    label: "Neolith",
    supplier: "Neolith",
    fullName: (c) => `Neolith ${c}`,
    thicknesses: [6, 12, 20],
    finishes: ["Silk", "Polished"],
    colours: [
      { name: "Arctic White", thicknesses: [12], finishes: ["Silk", "Polished", "Satin"] },
      { name: "Calacatta Gold" },
      { name: "Calacatta Luxe", finishes: ["Polished", "Ultrasoft"] },
      { name: "Estatuario", finishes: ["Silk", "Polished", "Ultrasoft"] },
      { name: "Superwhite" },
    ],
  },
  {
    id: "marble",
    kind: "NATURAL",
    label: "Marble",
    supplier: "Natural stone",
    fullName: (c) => `${c} marble`,
    thicknesses: [20, 30],
    finishes: ["Polished", "Honed", "Leathered"],
    colours: [{ name: "Arabescato" }, { name: "Calacatta" }, { name: "Calacatta Oro" }, { name: "Carrara" }, { name: "Statuario" }],
  },
  {
    id: "granite",
    kind: "NATURAL",
    label: "Granite",
    supplier: "Natural stone",
    fullName: (c) => `${c} granite`,
    thicknesses: [20, 30],
    finishes: ["Polished", "Honed", "Leathered"],
    colours: [{ name: "Absolute Black" }, { name: "Cosmic Black" }],
  },
  {
    id: "quartzite",
    kind: "NATURAL",
    label: "Quartzite",
    supplier: "Natural stone",
    fullName: (c) => `${c} quartzite`,
    thicknesses: [20, 30],
    finishes: ["Polished", "Honed", "Leathered"],
    colours: [
      { name: "Cristallo" },
      { name: "Emerald Haze" },
      { name: "Mont Blanc" },
      { name: "Patagonia" },
      { name: "Super White" },
      { name: "Taj Mahal" },
      { name: "White Macaubas" },
    ],
  },
];

/** The value a catalogue colour takes in a form: "cat:dekton:Lunar". */
export const catalogueKey = (range: CatalogueRange, colour: CatalogueColour) => `cat:${range.id}:${colour.name}`;

export const isCatalogueKey = (v: string) => v.startsWith("cat:");

export type CataloguePick = {
  range: CatalogueRange;
  colour: CatalogueColour;
  fullName: string;
  thicknesses: readonly number[];
  finishes: readonly string[];
};

/** A colour from its form value, with what it is made in; null if there is no such colour. */
export function fromCatalogueKey(key: string): CataloguePick | null {
  const m = /^cat:([a-z0-9-]+):(.+)$/.exec(key);
  if (!m) return null;
  const range = STONE_CATALOGUE.find((r) => r.id === m[1]);
  const colour = range?.colours.find((c) => c.name === m[2]);
  if (!range || !colour) return null;
  return {
    range,
    colour,
    fullName: range.fullName(colour.name),
    thicknesses: colour.thicknesses ?? range.thicknesses,
    finishes: colour.finishes ?? range.finishes,
  };
}

export const rangesOf = (kind: MaterialKind | "") => STONE_CATALOGUE.filter((r) => r.kind === kind);

/**
 * The material on file that is this catalogue colour, if any: named the full
 * way ("Dekton Lunar") or just by colour ("Lunar"), of the same type, without
 * regard to case. A colour on file is then offered once, not twice, and a job
 * for it is linked to the stock.
 */
export function onFileFor<T extends { name: string; kind: MaterialKind }>(
  pick: { range: CatalogueRange; colour: CatalogueColour },
  materials: readonly T[],
): T | undefined {
  const names = [pick.range.fullName(pick.colour.name), pick.colour.name].map((n) => n.toLowerCase());
  return materials.find((m) => m.kind === pick.range.kind && names.includes(m.name.trim().toLowerCase()));
}

/** The range of on-file colours the catalogue does not list. */
export const ON_FILE_RANGE = "file";

type FileMaterial = { id: string; name: string; kind: MaterialKind; thicknessMm: number; finish: string };

function catalogueMatch(m: FileMaterial) {
  for (const range of rangesOf(m.kind)) {
    for (const colour of range.colours) {
      if (onFileFor({ range, colour }, [m])) return { range, colour };
    }
  }
  return null;
}

/** The second dropdown: the ranges of one type, then "Other colours on file" when there are any. */
export function rangeOptions(kind: MaterialKind | "", materials: readonly FileMaterial[]) {
  if (!kind) return [];
  const out = rangesOf(kind).map((r) => ({ value: r.id, label: r.label }));
  if (materials.some((m) => m.kind === kind && !catalogueMatch(m))) {
    out.push({ value: ON_FILE_RANGE, label: "Other colours on file" });
  }
  return out;
}

/**
 * The colour dropdown for one range. A colour already on file is offered as
 * that material, so the job links to the stock; the rest by catalogue key.
 */
export function colourOptions(kind: MaterialKind | "", rangeId: string, materials: readonly FileMaterial[]) {
  if (!kind || !rangeId) return [];
  if (rangeId === ON_FILE_RANGE) {
    return materials
      .filter((m) => m.kind === kind && !catalogueMatch(m))
      .map((m) => ({ value: m.id, label: m.name, onFile: true }));
  }
  const range = STONE_CATALOGUE.find((r) => r.id === rangeId && r.kind === kind);
  if (!range) return [];
  return range.colours.map((colour) => {
    const m = onFileFor({ range, colour }, materials);
    return m
      ? { value: m.id, label: `${colour.name} (on file)`, onFile: true }
      : { value: catalogueKey(range, colour), label: colour.name, onFile: false };
  });
}

/**
 * The thicknesses and finishes one colour is made in, and where to start.
 * A catalogue colour gives its own; a colour on file adds what it is recorded
 * as, so it is always on its own list.
 */
export function sizeOptions(value: string, materials: readonly FileMaterial[]) {
  const none = { thicknesses: [] as number[], finishes: [] as string[], thicknessMm: "", finish: "" };
  if (!value) return none;

  // A stone typed in could be any of the usual sizes, and any finish.
  if (isNewStoneKey(value)) return newStoneName(value) ? finish(thicknessOptions(), finishOptions()) : none;

  if (isCatalogueKey(value)) {
    const pick = fromCatalogueKey(value);
    if (!pick) return none;
    return finish([...pick.thicknesses], [...pick.finishes]);
  }

  const m = materials.find((x) => x.id === value);
  if (!m) return none;
  const match = catalogueMatch(m);
  // A colour the catalogue does not know could be any of the usual sizes.
  const thicknesses = match
    ? [m.thicknessMm, ...(match.colour.thicknesses ?? match.range.thicknesses)]
    : thicknessOptions([m.thicknessMm]);
  const finishes = match
    ? [m.finish, ...(match.colour.finishes ?? match.range.finishes)]
    : finishOptions([m.finish]);
  return finish(thicknesses, finishes, String(m.thicknessMm), m.finish);

  function finish(ts: number[], fs: string[], t?: string, f?: string) {
    const thick = [...new Set(ts)].sort((a, b) => a - b);
    const seen = new Set<string>();
    const fins = fs.filter((x) => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()));
    // One choice is no choice: pick it. Otherwise 20 mm, the usual benchtop,
    // and the colour's first finish. Either can be changed.
    return {
      thicknesses: thick,
      finishes: fins,
      thicknessMm: t ?? String(thick.length === 1 ? thick[0] : thick.includes(20) ? 20 : thick[0]),
      finish: f ?? fins[0] ?? "",
    };
  }
}


/**
 * A word of caution when a catalogue colour is given a thickness or finish
 * its maker does not list: allowed, since ranges change and the office knows
 * its suppliers, but worth checking before it is quoted. Null when it is on
 * the list, or the colour is not one the catalogue knows.
 */
export function offMakersList(
  value: string,
  thicknessMm: number | string,
  finish: string,
  materials: readonly FileMaterial[] = [],
): string | null {
  let made: { name: string; thicknesses: readonly number[]; finishes: readonly string[] } | null = null;
  if (isCatalogueKey(value)) {
    const pick = fromCatalogueKey(value);
    if (pick) made = { name: pick.fullName, thicknesses: pick.thicknesses, finishes: pick.finishes };
  } else {
    const m = materials.find((x) => x.id === value);
    const match = m ? catalogueMatch(m) : null;
    if (m && match) {
      // What it is on file as counts as made, on top of the maker's list.
      made = {
        name: m.name,
        thicknesses: [m.thicknessMm, ...(match.colour.thicknesses ?? match.range.thicknesses)],
        finishes: [m.finish, ...(match.colour.finishes ?? match.range.finishes)],
      };
    }
  }
  if (!made) return null;
  const t = Number(thicknessMm);
  const f = finish.trim().toLowerCase();
  const offT = Number.isFinite(t) && t > 0 && !made.thicknesses.includes(t);
  const offF = f !== "" && !made.finishes.some((x) => x.toLowerCase() === f);
  if (!offT && !offF) return null;
  const what = [offT ? `${t} mm` : null, offF ? `a ${f} finish` : null].filter(Boolean).join(" or ");
  return `${made.name} is not listed in ${what}. Check with the supplier before quoting.`;
}
