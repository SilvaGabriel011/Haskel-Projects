/**
 * What might clash with something already in the book.
 *
 * Two kinds of clash, handled differently on purpose:
 *
 *  - TIME: someone already has a job overlapping this slot. That is a warning,
 *    not a wall. A quick measure before an install is sometimes exactly the
 *    plan, so the admin sees what it clashes with and decides.
 *  - DUPLICATE: the same phone number has another request in the last 30
 *    days. Usually one customer pressing submit twice. Also only a warning.
 *
 * Stock is the third kind and lives in lib/reservations.ts, because one offcut
 * cannot go to two jobs: that one refuses rather than warns.
 */
import { db } from "@/lib/db";

/** Half-open intervals: a job ending at 10:00 does not clash with one starting at 10:00. */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export type TimeConflict = {
  eventId: string;
  kind: string;
  startAt: Date;
  endAt: Date;
  jobNumber: string | null;
  people: string[];
};

/**
 * Events overlapping [startAt, endAt) that involve any of `userIds`.
 * Same overlap rule as `overlaps`, expressed in the query.
 */
export async function findTimeConflicts(
  startAt: Date,
  endAt: Date,
  userIds: string[],
): Promise<TimeConflict[]> {
  if (userIds.length === 0) return [];
  const rows = await db.scheduleEvent.findMany({
    where: {
      startAt: { lt: endAt },
      endAt: { gt: startAt },
      assignees: { some: { userId: { in: userIds } } },
    },
    select: {
      id: true, kind: true, startAt: true, endAt: true,
      order: { select: { jobNumber: true } },
      assignees: { select: { user: { select: { name: true } } } },
    },
    orderBy: { startAt: "asc" },
  });
  return rows.map((r) => ({
    eventId: r.id,
    kind: r.kind,
    startAt: r.startAt,
    endAt: r.endAt,
    jobNumber: r.order?.jobNumber ?? null,
    people: r.assignees.map((a) => a.user.name),
  }));
}

export const DUPLICATE_WINDOW_DAYS = 30;

/** Phone numbers compared on digits only: "0451 083 862" and "0451083862" are one person. */
export function samePhone(a: string, b: string): boolean {
  const digits = (s: string) => s.replace(/\D/g, "");
  return digits(a).length > 0 && digits(a) === digits(b);
}

export type PossibleDuplicate = { id: string; status: string; createdAt: Date; preferredAt: Date };

/**
 * Other requests from the same phone in the window, oldest first. Each request
 * is compared against every other, so both halves of a pair get flagged.
 */
export async function findDuplicateRequests(
  requests: Array<{ id: string; phone: string }>,
  now = new Date(),
): Promise<Map<string, PossibleDuplicate[]>> {
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recent = await db.bookingRequest.findMany({
    where: { createdAt: { gte: since } },
    select: { id: true, phone: true, status: true, createdAt: true, preferredAt: true },
    orderBy: { createdAt: "asc" },
  });

  const out = new Map<string, PossibleDuplicate[]>();
  for (const r of requests) {
    const twins = recent
      .filter((o) => o.id !== r.id && samePhone(o.phone, r.phone))
      .map(({ id, status, createdAt, preferredAt }) => ({ id, status, createdAt, preferredAt }));
    if (twins.length) out.set(r.id, twins);
  }
  return out;
}
