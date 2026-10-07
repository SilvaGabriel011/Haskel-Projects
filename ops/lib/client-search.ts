/**
 * Finding a client on New job by typing: their name, the person you deal
 * with there, their suburb, or any run of their phone number's digits
 * ("8370" finds 08 8370 1200, however it was typed).
 *
 * Pure, so it is unit tested and runs in the browser.
 */
export type ClientLike = {
  id: string;
  kind: "PERSON" | "COMPANY";
  name: string;
  contactName: string | null;
  phone: string;
  suburb: string;
};

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

/** Clients matching what was typed, best first: a name starting with it, then the rest. */
export function searchClients<T extends ClientLike>(clients: readonly T[], query: string, limit = 8): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const q = words.join(" ");
  const out: Array<{ c: T; score: number; i: number }> = [];
  clients.forEach((c, i) => {
    const digits = c.phone.replace(/\D/g, "");
    const hay = fold([c.name, c.contactName ?? "", c.suburb].join(" "));
    const ok = words.every((w) => hay.includes(w) || (/^\d+$/.test(w) && w.length >= 3 && digits.includes(w)));
    if (!ok) return;
    const name = fold(c.name);
    const score = name.startsWith(q) ? 0 : name.split(" ").some((part) => part.startsWith(words[0])) ? 1 : 2;
    out.push({ c, score, i });
  });
  return out
    .sort((a, b) => a.score - b.score || a.c.name.localeCompare(b.c.name) || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.c);
}

/** How a client reads in the list, under their name: "Sam · 0412 345 678 · Stirling". */
export const clientHint = (c: ClientLike) =>
  [c.kind === "COMPANY" ? "Company" : null, c.contactName, c.phone, c.suburb].filter(Boolean).join(" · ");

/**
 * What typing suggests for a new client: digits read as their phone, words
 * as their name. Null if it is too short to be either.
 */
export function newClientFrom(typed: string): { clientName: string } | { phone: string } | null {
  const t = typed.replace(/\s+/g, " ").trim();
  if (/^[\d\s()+-]+$/.test(t)) return t.replace(/\D/g, "").length >= 8 ? { phone: t } : null;
  return t.length >= 2 ? { clientName: t } : null;
}
