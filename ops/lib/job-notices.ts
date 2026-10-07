/**
 * What opening a job tells the world: the client's summary email, and the
 * calendar entries for the job.
 *
 * When New job saves, the office can have the client emailed everything that
 * was entered, so a wrong address or stone is caught by the client on day one
 * instead of on install day. The calendar gets:
 *
 * - a "ghost" entry on the day the job was opened: all day, and marked free,
 *   so it shows in the diary without blocking anyone's time;
 * - an entry on the target completion day, if one was set;
 * - a reminder entry a chosen number of days before it (presets 1, 3, 7 and
 *   14 days; 7 and 1 by default).
 *
 * Reminders are entries of their own, not alarms on the due entry: the app
 * writes as a service account, and an alarm set on an event only ever rings
 * for whoever set it, which would be the robot. An entry on the day is seen
 * by everyone who shares the calendar, and rings for anyone whose own
 * notifications for that calendar are on.
 *
 * Pure: imported by the form in the browser, and unit tested. Sending lives
 * in lib/job-notices-send.ts.
 */
import type { JobType } from "@prisma/client";

import { JOB_TYPE_LABEL } from "@/lib/job-options";

/** The reminder choices offered, in days before the target. */
export const REMINDER_PRESETS = [14, 7, 3, 1] as const;
export const DEFAULT_REMINDERS: readonly number[] = [7, 1];

export const reminderLabel = (days: number) =>
  days === 1 ? "1 day before" : days % 7 === 0 ? `${days / 7} week${days === 7 ? "" : "s"} before` : `${days} days before`;

/** The target completion choices offered on New job, in weeks from today. */
export const TARGET_PRESETS_WEEKS = [1, 2, 4, 6] as const;

/**
 * Where the target starts for each kind of job, in weeks: small work in two,
 * a benchtop install or splashback in four, which is how long templating,
 * the factory and the install usually take end to end. Always changeable.
 */
export const DEFAULT_TARGET_WEEKS: Record<JobType, number> = {
  OFFCUT_PROJECT: 2,
  VANITY_TOP: 2,
  SMALL_BENCHTOP: 2,
  REPAIR: 1,
  CUTOUT: 1,
  TOP_REMOVAL: 1,
  FULL_BENCHTOP: 4,
  SPLASHBACK: 4,
};

// ---- days, as "YYYY-MM-DD", counted without regard to time zones: the
// caller supplies today in the business's zone.

const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True for a real calendar day written YYYY-MM-DD. */
export function isDay(s: string): boolean {
  const m = DAY.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function addDaysTo(day: string, n: number): string {
  const m = DAY.exec(day)!;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10);
}

export const daysFrom = (a: string, b: string) =>
  Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/** "Wed 21 Oct 2026", for people. */
export function dayLabel(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-AU", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ---- what the form sends

export type NoticeChoices = {
  /** YYYY-MM-DD, or null for no target. */
  target: string | null;
  reminderDays: number[];
  emailClient: boolean;
};

/**
 * The target, reminders and email choice from the form. A target must be a
 * real day from today to two years out; reminders only from the presets,
 * and only with a target to count back from.
 */
export function readNoticeChoices(
  f: Record<string, unknown>,
  today: string,
): { ok: true; value: NoticeChoices } | { ok: false; reason: string } {
  const raw = typeof f.targetDate === "string" ? f.targetDate.trim() : "";
  let target: string | null = null;
  if (raw) {
    if (!isDay(raw)) return { ok: false, reason: "The target completion date does not look right." };
    const ahead = daysFrom(today, raw);
    if (ahead < 0) return { ok: false, reason: "The target completion date has already passed." };
    if (ahead > 730) return { ok: false, reason: "The target completion date is more than two years away." };
    target = raw;
  }

  const rawReminders = typeof f.reminders === "string" ? f.reminders : "";
  const reminderDays = target
    ? [...new Set(rawReminders.split(",").map((s) => Number(s.trim())))]
        .filter((n) => (REMINDER_PRESETS as readonly number[]).includes(n))
        .sort((a, b) => b - a)
    : [];

  return { ok: true, value: { target, reminderDays, emailClient: f.emailClient === "on" || f.emailClient === true } };
}

// ---- the job, as both the email and the calendar describe it

export type JobSummary = {
  jobNumber: string;
  clientName: string;
  /** Who the email greets: a company's contact, else the client. */
  greetName: string;
  phone: string;
  jobType: JobType;
  address: string;
  suburb: string;
  siteContactName: string | null;
  siteContactPhone: string | null;
  /** "Dekton Lunar · 20 mm · Matte", if chosen. */
  stone: string | null;
  sqm: number | null;
  notes: string | null;
  /** YYYY-MM-DD. */
  target: string | null;
};

function detailLines(j: JobSummary): string[] {
  return [
    `Job number: ${j.jobNumber}`,
    `Kind of job: ${JOB_TYPE_LABEL[j.jobType]}`,
    `Site: ${j.address}, ${j.suburb}`,
    j.siteContactName || j.siteContactPhone
      ? `At the site: ${[j.siteContactName, j.siteContactPhone].filter(Boolean).join(", ")}`
      : null,
    j.stone ? `Stone: ${j.stone}` : "Stone: not chosen yet",
    j.stone && j.sqm ? `Area: about ${j.sqm} m²` : null,
    j.target ? `We aim to finish by: ${dayLabel(j.target)}` : null,
    j.notes ? `Notes: ${j.notes}` : null,
  ].filter((l): l is string => Boolean(l));
}

/**
 * The client's email: everything entered, in plain text, so it reads the
 * same in every mail app and nothing is lost to formatting. `contact` is how
 * to reach the business (BUSINESS_CONTACT), if set.
 */
export function summaryEmail(j: JobSummary, contact?: string | null): { subject: string; text: string } {
  const first = j.greetName.trim().split(/\s+/)[0] || j.greetName;
  const fix = contact?.trim()
    ? `If anything here is not right, let us know: ${contact.trim()}.`
    : "If anything here is not right, please let us know.";
  return {
    subject: `Your job with Haskel Project: ${j.jobNumber}`,
    text: [
      `Hi ${first},`,
      "",
      "Thanks for choosing Haskel Project. Here is what we have down for your job:",
      "",
      ...detailLines(j).map((l) => `  ${l}`),
      "",
      fix,
      "",
      "Haskel Project",
    ].join("\n"),
  };
}

export type PlannedEntry = {
  /** Which entry this is: "opened", "due" or "reminder-7". */
  key: string;
  /** All day, YYYY-MM-DD. */
  day: string;
  summary: string;
  description: string;
  location: string;
};

/**
 * The calendar entries for a newly opened job. Reminders that would fall
 * before today are left out, since they could only ring late; so is one
 * landing on the target day itself.
 */
export function plannedEntries(j: JobSummary, opened: string, reminderDays: readonly number[]): PlannedEntry[] {
  const location = `${j.address}, ${j.suburb}`;
  const who = `${j.jobNumber} · ${j.clientName}`;
  const description = [...detailLines(j), "", "Made by Haskel Ops when the job was opened."].join("\n");
  const out: PlannedEntry[] = [{ key: "opened", day: opened, summary: `Opened · ${who}`, description, location }];
  if (!j.target) return out;
  out.push({ key: "due", day: j.target, summary: `Due · ${who}`, description, location });
  for (const n of [...new Set(reminderDays)].sort((a, b) => b - a)) {
    const day = addDaysTo(j.target, -n);
    if (n <= 0 || daysFrom(opened, day) < 0) continue;
    out.push({
      key: `reminder-${n}`,
      day,
      summary: `Reminder · ${who} due in ${reminderLabel(n).replace(" before", "")}`,
      description: [`Due ${dayLabel(j.target)}.`, "", description].join("\n"),
      location,
    });
  }
  return out;
}
