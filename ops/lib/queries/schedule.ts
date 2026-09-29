/**
 * Schedule queries.
 *
 * The role rule here is not a default, it is a constraint: an employee sees
 * their own week. Passing someone else's id in the query string does not widen
 * it — `visibleTo` overrides the filter rather than trusting it.
 */
import type { Role } from "@prisma/client";

import { addDays, daysBetween, startOfDay, weekStart } from "@/lib/business-time";
import { db } from "@/lib/db";

// Weeks and days are the business's, not the server's: the server runs in UTC,
// where Monday midnight is already 9:30am in Adelaide. See lib/business-time.ts.
export { addDays, weekStart };

/**
 * Whose events this viewer may see.
 * - admin: anyone, optionally narrowed by `requested`
 * - employee: themselves, whatever was requested
 */
export function visibleTo(role: Role, selfId: string, requested?: string): string | undefined {
  if (role === "ADMIN") return requested || undefined;
  return selfId;
}

const EVENT_SELECT = {
  id: true,
  kind: true,
  startAt: true,
  endAt: true,
  address: true,
  notes: true,
  googleEventId: true,
  order: {
    select: {
      id: true, jobNumber: true, jobType: true, pipeline: true,
      // Where the job is, so lib/routes can group a week into runs. Not money,
      // so both roles read it.
      suburb: true,
      customer: { select: { name: true, phone: true } },
    },
  },
  assignees: { select: { user: { select: { id: true, name: true } } } },
} as const;

export type ScheduleEvent = Awaited<ReturnType<typeof listWeek>>[number];

export async function listWeek(from: Date, userId?: string) {
  return db.scheduleEvent.findMany({
    where: {
      startAt: { gte: from, lt: addDays(from, 7) },
      ...(userId ? { assignees: { some: { userId } } } : {}),
    },
    select: EVENT_SELECT,
    orderBy: { startAt: "asc" },
  });
}

/** Today's run, for the person standing in front of the job. */
export async function listDay(day: Date, userId?: string) {
  const from = startOfDay(day);
  return db.scheduleEvent.findMany({
    where: {
      startAt: { gte: from, lt: addDays(from, 1) },
      ...(userId ? { assignees: { some: { userId } } } : {}),
    },
    select: EVENT_SELECT,
    orderBy: { startAt: "asc" },
  });
}

/** Group a week's events into seven day buckets, Monday first. */
export function byDay<T extends { startAt: Date }>(events: T[], from: Date): T[][] {
  const days: T[][] = Array.from({ length: 7 }, () => []);
  for (const e of events) {
    const i = daysBetween(from, e.startAt);
    if (i >= 0 && i < 7) days[i].push(e);
  }
  return days;
}

export async function crew() {
  return db.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
}
