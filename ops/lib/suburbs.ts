/**
 * Where Adelaide's suburbs are, roughly.
 *
 * The system stores a suburb as free text and a street address as a free line;
 * there are no coordinates anywhere. So "these two jobs are close together"
 * cannot be answered from the data as stored. This table is the smallest thing
 * that answers it: one approximate centre point per suburb.
 *
 * Deliberately NOT geocoding. A real geocoder is more accurate, but it needs an
 * API key, costs per lookup, and — the part that matters — every address it
 * fails to resolve silently drops out of routing. This ships with the app, has
 * no network call and no failure mode, and an unknown suburb simply does not
 * group rather than disappearing.
 *
 * The centroids are approximate by design: they place a suburb, not a house.
 * Two jobs in the same suburb read as zero apart, which for a metro suburb a
 * kilometre or two across is close enough to decide whether to do them in one
 * run. A coordinate being slightly off changes only whether two jobs group —
 * it cannot make any other figure in the system wrong.
 */

export type Suburb = {
  name: string;
  lat: number;
  lng: number;
};

/**
 * Adelaide metro, north to south. Not exhaustive: adding a row is the intended
 * way to extend it, and a suburb missing from here still works everywhere else
 * in the app — it just never appears in a group.
 */
export const SUBURBS: readonly Suburb[] = [
  // --- north
  { name: "Gawler", lat: -34.5983, lng: 138.745 },
  { name: "Munno Para", lat: -34.6667, lng: 138.6933 },
  { name: "Smithfield", lat: -34.6883, lng: 138.6817 },
  { name: "Craigmore", lat: -34.705, lng: 138.7 },
  { name: "Elizabeth", lat: -34.7167, lng: 138.6667 },
  { name: "Burton", lat: -34.745, lng: 138.5967 },
  { name: "Direk", lat: -34.75, lng: 138.625 },
  { name: "Salisbury", lat: -34.7583, lng: 138.6417 },
  { name: "Paralowie", lat: -34.7633, lng: 138.6183 },
  { name: "Parafield Gardens", lat: -34.7767, lng: 138.6083 },
  { name: "Golden Grove", lat: -34.7883, lng: 138.71 },
  { name: "Para Hills", lat: -34.8067, lng: 138.6483 },
  { name: "Mawson Lakes", lat: -34.81, lng: 138.61 },
  { name: "Pooraka", lat: -34.8233, lng: 138.6183 },
  { name: "Ingle Farm", lat: -34.8283, lng: 138.64 },
  { name: "Modbury", lat: -34.83, lng: 138.685 },
  { name: "Valley View", lat: -34.8383, lng: 138.6567 },
  { name: "Gepps Cross", lat: -34.845, lng: 138.5967 },
  { name: "Northfield", lat: -34.845, lng: 138.625 },
  { name: "Holden Hill", lat: -34.8467, lng: 138.6733 },
  { name: "Clearview", lat: -34.8483, lng: 138.6117 },
  { name: "Oakden", lat: -34.85, lng: 138.64 },
  { name: "Dernancourt", lat: -34.855, lng: 138.6783 },
  { name: "Highbury", lat: -34.8583, lng: 138.695 },
  { name: "Enfield", lat: -34.8583, lng: 138.61 },
  { name: "Windsor Gardens", lat: -34.8617, lng: 138.6483 },
  { name: "Athelstone", lat: -34.8683, lng: 138.7 },
  { name: "Broadview", lat: -34.8683, lng: 138.61 },
  { name: "Sefton Park", lat: -34.8717, lng: 138.6033 },
  { name: "Klemzig", lat: -34.8733, lng: 138.6283 },
  { name: "Paradise", lat: -34.8733, lng: 138.6733 },
  { name: "Nailsworth", lat: -34.8783, lng: 138.6 },
  { name: "Newton", lat: -34.8817, lng: 138.6883 },
  { name: "Kilkenny", lat: -34.8817, lng: 138.545 },
  { name: "Prospect", lat: -34.8833, lng: 138.5936 },
  { name: "Campbelltown", lat: -34.8833, lng: 138.665 },
  { name: "Hectorville", lat: -34.8867, lng: 138.6567 },
  { name: "Seaton", lat: -34.8867, lng: 138.5117 },
  { name: "Payneham", lat: -34.8933, lng: 138.645 },
  { name: "Walkerville", lat: -34.8967, lng: 138.6183 },
  { name: "Croydon", lat: -34.8967, lng: 138.5583 },
  { name: "Findon", lat: -34.8967, lng: 138.53 },

  // --- west and the coast
  { name: "Largs Bay", lat: -34.82, lng: 138.485 },
  { name: "Semaphore", lat: -34.8397, lng: 138.4797 },
  { name: "Port Adelaide", lat: -34.85, lng: 138.5033 },
  { name: "West Lakes", lat: -34.87, lng: 138.495 },
  { name: "Woodville", lat: -34.8767, lng: 138.5433 },
  { name: "Grange", lat: -34.9, lng: 138.49 },
  { name: "Fulham Gardens", lat: -34.9083, lng: 138.5017 },
  { name: "Henley Beach", lat: -34.92, lng: 138.495 },
  { name: "Fulham", lat: -34.9283, lng: 138.5133 },

  // --- city and inner
  { name: "Magill", lat: -34.9067, lng: 138.6717 },
  { name: "Hindmarsh", lat: -34.9067, lng: 138.5717 },
  { name: "Bowden", lat: -34.9033, lng: 138.5817 },
  { name: "Tranmere", lat: -34.9017, lng: 138.6617 },
  { name: "Thebarton", lat: -34.9167, lng: 138.5717 },
  { name: "Norwood", lat: -34.9203, lng: 138.6289 },
  { name: "Mile End", lat: -34.9233, lng: 138.5717 },
  { name: "Kensington", lat: -34.925, lng: 138.6417 },
  { name: "Adelaide", lat: -34.9285, lng: 138.6007 },
  { name: "Erindale", lat: -34.9317, lng: 138.6683 },
  { name: "Rose Park", lat: -34.9317, lng: 138.625 },
  { name: "Burnside", lat: -34.9367, lng: 138.6533 },
  { name: "Richmond", lat: -34.94, lng: 138.5617 },
  { name: "Keswick", lat: -34.9417, lng: 138.5783 },
  { name: "Parkside", lat: -34.945, lng: 138.6117 },
  { name: "Glenunga", lat: -34.945, lng: 138.635 },
  { name: "Hyde Park", lat: -34.9483, lng: 138.6033 },
  { name: "Beaumont", lat: -34.9483, lng: 138.66 },
  { name: "Unley", lat: -34.95, lng: 138.605 },
  { name: "Goodwood", lat: -34.9517, lng: 138.5933 },
  { name: "Plympton", lat: -34.9533, lng: 138.5533 },
  { name: "Glen Osmond", lat: -34.9583, lng: 138.6483 },

  // --- south
  { name: "Springfield", lat: -34.9683, lng: 138.6283 },
  { name: "Colonel Light Gardens", lat: -34.975, lng: 138.6 },
  { name: "Edwardstown", lat: -34.9767, lng: 138.5683 },
  { name: "Mitcham", lat: -34.98, lng: 138.6167 },
  { name: "Glenelg", lat: -34.9803, lng: 138.5127 },
  { name: "Melrose Park", lat: -34.985, lng: 138.58 },
  { name: "Daw Park", lat: -34.985, lng: 138.5883 },
  { name: "Stirling", lat: -35.0, lng: 138.7167 },
  { name: "Marion", lat: -35.0117, lng: 138.5567 },
  { name: "Aldgate", lat: -35.0167, lng: 138.7383 },
  { name: "Brighton", lat: -35.0175, lng: 138.5215 },
  { name: "Blackwood", lat: -35.0217, lng: 138.615 },
  { name: "Hahndorf", lat: -35.0283, lng: 138.81 },
  { name: "Littlehampton", lat: -35.0433, lng: 138.86 },
  { name: "Mount Barker", lat: -35.0667, lng: 138.8583 },
  { name: "Hallett Cove", lat: -35.0783, lng: 138.5117 },
  { name: "Morphett Vale", lat: -35.1167, lng: 138.5217 },
  { name: "Christies Beach", lat: -35.1383, lng: 138.4717 },
  { name: "Noarlunga", lat: -35.14, lng: 138.495 },
  { name: "Port Noarlunga", lat: -35.1483, lng: 138.47 },
  { name: "Seaford", lat: -35.1917, lng: 138.475 },
  { name: "McLaren Vale", lat: -35.2233, lng: 138.545 },
  { name: "Willunga", lat: -35.2717, lng: 138.5533 },
  { name: "Aldinga", lat: -35.27, lng: 138.46 },
  { name: "Aldinga Beach", lat: -35.2783, lng: 138.4583 },
] as const;

/** Lower-cased name → suburb, built once. */
const BY_NAME = new Map(SUBURBS.map((s) => [s.name.toLowerCase(), s]));

/**
 * The state and postcode people tack on the end of a suburb.
 *
 * These fields are typed by hand into a booking form or an order, so the same
 * suburb arrives as "Prospect", "prospect", "Prospect SA" and
 * "Prospect, SA 5082". Matching only the exact string would silently stop those
 * grouping, which looks like the feature not working rather than a data issue.
 */
// Anchored to the end rather than closed with \b: "prospect s.a." ends on a
// full stop, and a word boundary cannot match between a full stop and the end
// of the string. Requiring a separator in front means a suburb whose own name
// contains the letters — Salisbury, Seaton — is never truncated.
const TRAILING_STATE = /[,\s]+(s\.?\s?a\.?|south\s+australia)\s*$/i;
const TRAILING_POSTCODE = /[,\s]+\d{4}\s*$/;

/**
 * A free-text suburb as the canonical name, or null if it is not one we know.
 *
 * Null is an ordinary answer, not a failure: the caller shows the job normally
 * and simply never groups it.
 */
export function normaliseSuburb(raw: unknown): string | null {
  if (typeof raw !== "string") return null;

  const cleaned = raw
    .trim()
    .replace(TRAILING_POSTCODE, "")
    .replace(TRAILING_STATE, "")
    .replace(/[,\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return null;
  return BY_NAME.get(cleaned.toLowerCase())?.name ?? null;
}

/** The centroid of a free-text suburb, or null. */
export function suburbPoint(raw: unknown): Suburb | null {
  const name = normaliseSuburb(raw);
  return name ? (BY_NAME.get(name.toLowerCase()) ?? null) : null;
}

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * Kilometres between two points, over the curve of the earth.
 *
 * Haversine rather than flat Pythagoras on degrees: a degree of longitude is
 * about 18% shorter than a degree of latitude at Adelaide's latitude, so the
 * flat version reads distances across the city as further apart than they are.
 */
export function distanceKm(a: Suburb, b: Suburb): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance between two free-text suburbs, or null if either is unknown. */
export function suburbDistanceKm(a: unknown, b: unknown): number | null {
  const pa = suburbPoint(a);
  const pb = suburbPoint(b);
  if (!pa || !pb) return null;
  return distanceKm(pa, pb);
}
