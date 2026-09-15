/**
 * Money is integer cents everywhere. These are the only places it becomes a
 * string, and it never becomes a float in between.
 */
export function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

/** Margin on a completed job: what came in, less what it cost to do. */
export function marginCents(input: {
  quoteCents: number;
  materialCostCents: number;
  labourHours: number;
  labourRateCents: number;
}): number {
  const labour = Math.round(input.labourHours * input.labourRateCents);
  return input.quoteCents - input.materialCostCents - labour;
}

/** Margin as a percentage of the quote. Zero-safe. */
export function marginPct(quoteCents: number, margin: number): number {
  if (quoteCents <= 0) return 0;
  return Math.round((margin / quoteCents) * 1000) / 10;
}

/** What the business charges itself for an hour on the tools. */
export const LABOUR_RATE_CENTS = 9500;
