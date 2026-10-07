/**
 * Sending what a newly opened job tells the world (lib/job-notices.ts): the
 * client's summary email and the calendar entries.
 *
 * Runs after the job is saved, and never undoes it: a mail service or a
 * calendar that is not set up, or is down, leaves a job that is open as
 * normal, with the outcome reported back so the job page can say so.
 */
import { isoDay } from "@/lib/business-time";
import { db } from "@/lib/db";
import { pushAllDay, type Fetch } from "@/lib/google-calendar";
import { plannedEntries, summaryEmail, type JobSummary } from "@/lib/job-notices";
import { sendMail } from "@/lib/mail";

/** What happened, one word each, for the job page's notice. */
export type NoticeOutcome = {
  email: "sent" | "skipped" | "no-email" | "not-configured" | "failed";
  calendar: "added" | "not-configured" | "failed";
};

export async function sendJobNotices(
  orderId: string,
  opts: { emailClient: boolean },
  fetchFn: Fetch = fetch,
  now = new Date(),
): Promise<NoticeOutcome & { detail?: string }> {
  const o = await db.order.findUniqueOrThrow({
    where: { id: orderId },
    select: {
      jobNumber: true,
      jobType: true,
      address: true,
      suburb: true,
      notes: true,
      siteContactName: true,
      siteContactPhone: true,
      targetCompletionAt: true,
      reminderDays: true,
      customer: { select: { name: true, contactName: true, phone: true, email: true } },
      lines: { select: { description: true, sqm: true }, take: 1 },
    },
  });

  const job: JobSummary = {
    jobNumber: o.jobNumber,
    clientName: o.customer.name,
    greetName: o.customer.contactName ?? o.customer.name,
    phone: o.customer.phone,
    jobType: o.jobType,
    address: o.address,
    suburb: o.suburb,
    siteContactName: o.siteContactName,
    siteContactPhone: o.siteContactPhone,
    stone: o.lines[0]?.description ?? null,
    sqm: o.lines[0]?.sqm || null,
    notes: o.notes,
    target: o.targetCompletionAt ? isoDay(o.targetCompletionAt) : null,
  };

  const details: string[] = [];

  // ---- the client's email
  let email: NoticeOutcome["email"] = "skipped";
  if (opts.emailClient) {
    if (!o.customer.email) email = "no-email";
    else {
      const sent = await sendMail({ to: o.customer.email, ...summaryEmail(job, process.env.BUSINESS_CONTACT) }, fetchFn);
      email = sent.ok ? "sent" : sent.reason;
      if (sent.ok) await db.order.update({ where: { id: orderId }, data: { summaryEmailedAt: now } });
      else if (sent.detail) details.push(`Email: ${sent.detail}`);
    }
  }

  // ---- the calendar: one entry at a time, keeping what was made even if a
  // later one fails, so nothing written is left untracked.
  let calendar: NoticeOutcome["calendar"] = "added";
  const made: string[] = [];
  for (const entry of plannedEntries(job, isoDay(now), o.reminderDays)) {
    const r = await pushAllDay(entry, fetchFn);
    if (r.ok) {
      made.push(r.googleEventId);
      continue;
    }
    calendar = r.reason;
    if (r.detail) details.push(`Calendar: ${r.detail}`);
    break;
  }
  if (made.length) await db.order.update({ where: { id: orderId }, data: { calendarEventIds: made } });

  return { email, calendar, ...(details.length ? { detail: details.join(" ") } : {}) };
}
