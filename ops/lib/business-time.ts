/**
 * Dates as the business sees them.
 *
 * The server runs in UTC. The business runs in BUSINESS_TIMEZONE (Adelaide,
 * UTC+9:30 with daylight saving). Any
 * code that asks a Date for its hours, its day, or "midnight" gets the
 * server's answer unless told otherwise, which is how a 9am job showed as 1am
 * and a Monday 7am job landed in the previous week. Everything that formats a
 * time or finds a day boundary goes through here instead.
 *
 * With BUSINESS_TIMEZONE unset (local development, CI) the zone is left to the
 * runtime, so behaviour there is unchanged.
 *
 * No library: Intl already knows every zone and its daylight saving, and the
 * one tricky step, local wall time to an instant, is done by measuring the
 * zone's offset rather than assuming one.
 */
import { businessTimezone } from "@/lib/google-calendar";

/** The zone to render and reason in; undefined means "the runtime's own". */
export function businessZone(): string | undefined {
  return businessTimezone() ?? undefined;
}

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAY: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** The wall-clock reading of `d` in `tz`. Month is 1 to 12, weekday 0 (Sun) to 6. */
export function zonedParts(d: Date, tz = businessZone()): Parts {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
    second: Number(p.second),
    weekday: WEEKDAY[p.weekday] ?? 0,
  };
}

/** How far `tz` is ahead of UTC at instant `d`, in milliseconds. */
function offsetMs(d: Date, tz: string | undefined): number {
  const p = zonedParts(d, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `tz` reads this time. Month is 1 to
 * 12 and may overflow (month 13 is January next year), as may day.
 */
export function zonedTime(
  year: number, month: number, day: number, hour = 0, minute = 0, tz = businessZone(),
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // Measure the offset at the guess, then again at the corrected instant: the
  // two differ only across a daylight saving change, and the second is right.
  const first = guess - offsetMs(new Date(guess), tz);
  return new Date(guess - offsetMs(new Date(first), tz));
}

/** Local midnight of the day containing `d`. */
export function startOfDay(d: Date, tz = businessZone()): Date {
  const p = zonedParts(d, tz);
  return zonedTime(p.year, p.month, p.day, 0, 0, tz);
}

/** Local midnight `n` calendar days after the day containing `d`. */
export function addDays(d: Date, n: number, tz = businessZone()): Date {
  const p = zonedParts(d, tz);
  return zonedTime(p.year, p.month, p.day + n, 0, 0, tz);
}

/** Local midnight on the Monday of the week containing `d`. */
export function weekStart(d: Date, tz = businessZone()): Date {
  const p = zonedParts(d, tz);
  const sinceMonday = (p.weekday + 6) % 7;
  return zonedTime(p.year, p.month, p.day - sinceMonday, 0, 0, tz);
}

/** Local midnight on the 1st of the month `n` months before the one containing `d`. */
export function monthStart(d: Date, n = 0, tz = businessZone()): Date {
  const p = zonedParts(d, tz);
  return zonedTime(p.year, p.month - n, 1, 0, 0, tz);
}

/** Calendar days from `from` to `to` in `tz`, ignoring the time of day. */
export function daysBetween(from: Date, to: Date, tz = businessZone()): number {
  const a = zonedParts(from, tz);
  const b = zonedParts(to, tz);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** "2026-09" for the month containing `d`. */
export function monthKey(d: Date, tz = businessZone()): string {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}`;
}

/** "2026-09-14" for the day containing `d`. For URLs, where toISOString would give the UTC day. */
export function isoDay(d: Date, tz = businessZone()): string {
  const p = zonedParts(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/**
 * A wall-clock time with no zone, as a datetime-local input sends it
 * ("2026-09-30T09:00"), read as business time. Anything carrying its own
 * offset or Z is left to Date.
 */
export function parseWallTime(raw: string, tz = businessZone()): Date {
  const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/);
  if (!m) return new Date(raw);
  const [, y, mo, d, h, mi] = m.map(Number);
  return zonedTime(y, mo, d, h, mi, tz);
}

/** toLocale*String in the business zone. `timeZone` in opts wins. */
export function formatDate(d: Date, opts: Intl.DateTimeFormatOptions, tz = businessZone()): string {
  return d.toLocaleString("en-AU", { timeZone: tz, ...opts });
}

export const formatTime = (d: Date, tz = businessZone()) =>
  formatDate(d, { hour: "numeric", minute: "2-digit" }, tz);
