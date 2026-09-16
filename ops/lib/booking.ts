/**
 * Validation and rate limiting for the one public write endpoint.
 *
 * Everything here assumes the caller is hostile. This is the single route in
 * the whole back office that an unauthenticated stranger can reach, so it is
 * the only place where "what if they send rubbish" is not hypothetical.
 */
import type { JobType } from "@prisma/client";

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
  const d = new Date(raw);
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
 * Per-IP rate limit, in memory.
 *
 * Honest about what it is: one serverless instance's memory, so it slows a
 * casual flood rather than stopping a determined one. Good enough for a
 * stonemason's booking form; if real spam arrives, put Turnstile in front.
 */
const hits = new Map<string, number[]>();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export function rateLimit(ip: string, now = Date.now()): { ok: boolean; retryAfterMs?: number } {
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - recent[0]) };
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear(); // crude ceiling; never grows unbounded
  return { ok: true };
}

/** Only for tests — the map is module state. */
export function _resetRateLimit() {
  hits.clear();
}
