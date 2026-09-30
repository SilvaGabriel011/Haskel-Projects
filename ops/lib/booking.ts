/**
 * Validation and rate limiting for the one public write endpoint.
 *
 * Everything here assumes the caller is hostile. This is the single route in
 * the whole back office that an unauthenticated stranger can reach, so it is
 * the only place where "what if they send rubbish" is not hypothetical.
 */
import type { JobType } from "@prisma/client";
import { parseWallTime } from "@/lib/business-time";

/** Job types a customer may pick. Deliberately narrower than the internal enum. */
export const BOOKABLE: readonly JobType[] = [
  "OFFCUT_PROJECT",
  "VANITY_TOP",
  "SMALL_BENCHTOP",
  "REPAIR",
  "CUTOUT",
  "SPLASHBACK",
] as const;

export const BOOKABLE_LABEL: Record<string, string> = {
  OFFCUT_PROJECT: "Something from an offcut",
  VANITY_TOP: "Vanity top",
  SMALL_BENCHTOP: "Small benchtop",
  REPAIR: "Repair a chip or crack",
  CUTOUT: "Cut-out for a cooktop or sink",
  SPLASHBACK: "Splashback",
};

export type BookingInput = {
  name: string;
  phone: string;
  email?: string | null;
  suburb: string;
  jobType: JobType;
  notes?: string | null;
  preferredAt: Date;
  alternateAt?: Date | null;
};

export type Validated = { ok: true; value: BookingInput } | { ok: false; reason: string };

const MAX = { name: 80, phone: 30, email: 120, suburb: 60, notes: 1000 };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** A booking must be in the future, and not absurdly far into it. */
function parseWhen(v: unknown, now: Date): Date | null {
  const raw = str(v);
  if (!raw) return null;
  // The form's datetime-local sends wall time with no zone ("2026-09-30T09:00").
  // new Date() would read that in the server's zone, UTC, and book the customer
  // eight hours late. It is the business's clock the customer is looking at.
  const d = parseWallTime(raw);
  if (Number.isNaN(d.getTime())) return null;
  if (d.getTime() < now.getTime()) return null;
  if (d.getTime() > now.getTime() + 365 * 86_400_000) return null;
  return d;
}

export function validateBooking(form: Record<string, unknown>, now = new Date()): Validated {
  // Honeypot: a real person never fills a field they cannot see.
  if (str(form.company)) return { ok: false, reason: "No thanks." };

  const name = str(form.name);
  if (name.length < 2) return { ok: false, reason: "Please give us a name to call you by." };
  if (name.length > MAX.name) return { ok: false, reason: "That name is too long." };

  const phone = str(form.phone);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) {
    return { ok: false, reason: "That phone number does not look right." };
  }
  if (phone.length > MAX.phone) return { ok: false, reason: "That phone number is too long." };

  const email = str(form.email);
  if (email && (!email.includes("@") || email.length > MAX.email)) {
    return { ok: false, reason: "That email address does not look right." };
  }

  const suburb = str(form.suburb);
  if (suburb.length < 2) return { ok: false, reason: "Which suburb is the job in?" };
  if (suburb.length > MAX.suburb) return { ok: false, reason: "That suburb is too long." };

  const jobType = str(form.jobType) as JobType;
  if (!BOOKABLE.includes(jobType)) return { ok: false, reason: "Pick what the job is." };

  const preferredAt = parseWhen(form.preferredAt, now);
  if (!preferredAt) return { ok: false, reason: "Pick a time in the next year." };

  const alternateAt = parseWhen(form.alternateAt, now);

  const notes = str(form.notes);
  if (notes.length > MAX.notes) return { ok: false, reason: "That message is too long." };

  return {
    ok: true,
    value: {
      name, phone, suburb, jobType, preferredAt,
      email: email || null,
      notes: notes || null,
      alternateAt,
    },
  };
}

/**
 * Who is asking, as far as the headers can be trusted to say.
 *
 * X-Forwarded-For is a list the client starts and each proxy appends to, so
 * its FIRST entry is whatever the client chose to write. Keying the limit on it
 * let anyone send a new made-up address with every request and never be
 * limited at all. Only the entries added by proxies we run behind are real.
 *
 *  - On Vercel the edge overwrites X-Forwarded-For and sets X-Real-IP to the
 *    address it actually saw, so those are the client.
 *  - Anywhere else, count `trustedHops` in from the RIGHT of the list: with
 *    one reverse proxy in front (the usual case, and the default) that is the
 *    last entry, the one our proxy appended. With no proxy at all nothing in
 *    these headers can be trusted; set TRUSTED_PROXY_HOPS=0 and every request
 *    shares one bucket, which is strict but cannot be dodged.
 */
export function clientIp(
  headers: Pick<Headers, "get">,
  env: { onVercel: boolean; trustedHops: number },
): string {
  const forwarded = (headers.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (env.onVercel) {
    return headers.get("x-real-ip")?.trim() || forwarded[0] || "unknown";
  }
  if (env.trustedHops < 1) return "unknown";
  return forwarded[forwarded.length - env.trustedHops] ?? "unknown";
}

/** TRUSTED_PROXY_HOPS as a whole number; unset or nonsense means one proxy. */
export function trustedProxyHops(raw = process.env.TRUSTED_PROXY_HOPS): number {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== "" && Number.isInteger(n) && n >= 0 ? n : 1;
}

/**
 * Per-IP rate limit, in memory.
 *
 * Honest about what it is: one serverless instance's memory, so it slows a
 * casual flood rather than stopping a determined one. Good enough for a
 * stonemason's booking form; if real spam arrives, put Turnstile in front.
 *
 * The map is capped, and it used to be emptied outright when it reached the
 * cap — so a few thousand requests from made-up addresses wiped everyone's
 * count, the sender's own included. Now expired entries go first, and past
 * that only the addresses that have been quiet longest; whoever is sending
 * right now is the last thing forgotten.
 */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
export const MAX_TRACKED = 5000;

export function rateLimit(ip: string, now = Date.now()): { ok: boolean; retryAfterMs?: number } {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    // Re-insert so a busy sender stays at the recent end of the map.
    hits.delete(ip);
    hits.set(ip, recent);
    return { ok: false, retryAfterMs: WINDOW_MS - (now - recent[0]) };
  }
  recent.push(now);
  hits.delete(ip);
  hits.set(ip, recent);
  if (hits.size > MAX_TRACKED) evict(now);
  return { ok: true };
}

function evict(now: number) {
  for (const [key, times] of hits) {
    if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
  }
  // Still full of live entries: drop the quietest. Map order is insertion
  // order, and every hit re-inserts, so the front is the least recent.
  for (const key of hits.keys()) {
    if (hits.size <= MAX_TRACKED) break;
    hits.delete(key);
  }
}

/** Only for tests — the map is module state. */
export function _resetRateLimit() {
  hits.clear();
}
