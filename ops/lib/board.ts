/**
 * The follow-up board: which jobs need chasing, and why.
 *
 * `/orders` answers "where is everything". This answers the different question
 * of "what is going wrong" — a job sitting too long in its stage, an install
 * date that has passed, or a customer record too thin to actually do the work.
 *
 * Pure and free of the database, like lib/pipeline.ts, so the thresholds and
 * the traffic lights are unit tested rather than only eyeballed on screen.
 */
import type { OrderStatus, Pipeline } from "@prisma/client";

import { FINAL_STAGE, STAGES, phase } from "@/lib/pipeline";
import { OVER_3_DAYS_MS, OVER_5_DAYS_MS } from "@/lib/stage-timing";

/** Green, amber, red. Ordered, so the worst of several is just a max. */
export const TONES = ["ok", "warn", "late"] as const;
export type Tone = (typeof TONES)[number];

const RANK: Record<Tone, number> = { ok: 0, warn: 1, late: 2 };

export function worst(...tones: Tone[]): Tone {
  return tones.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
}

export const TONE_LABEL: Record<Tone, string> = {
  ok: "Within target",
  warn: "Over 3 days",
  late: "Over 5 days",
};

/**
 * One pair of thresholds for every stage: over three days is amber, over five
 * is red. Shared with the stage timeline rather than restated, so the board and
 * the timeline can never disagree about whether a job is late.
 *
 * These used to differ per stage, on the reasoning that fabrication legitimately
 * takes longer than an enquiry. Flat is what the business actually runs, and one
 * number everybody knows beats a table nobody remembers.
 */
export const WARN_DAYS = OVER_3_DAYS_MS / 86_400_000;
export const LATE_DAYS = OVER_5_DAYS_MS / 86_400_000;

export function ageTone(status: OrderStatus, days: number): Tone {
  // A finished or abandoned job is never chased.
  if (status === FINAL_STAGE || status === "LOST") return "ok";
  if (days >= LATE_DAYS) return "late";
  if (days >= WARN_DAYS) return "warn";
  return "ok";
}

// ------------------------------------------------------------ missing detail

/**
 * A gap in what the office holds about a job.
 *
 * `blocking` means the work cannot actually be done or the customer cannot be
 * reached — that is red on its own. Everything else is amber: worth filling in,
 * not worth stopping for.
 */
export type Gap = { field: string; label: string; blocking: boolean };

/**
 * Placeholders the system writes when it does not know yet.
 *
 * acceptBooking sets the address to "To confirm on the call", which is a real
 * string in a required column — so a job can look complete while nobody knows
 * where to drive. Matching it is the point of this list.
 */
const PLACEHOLDERS = [/to confirm/i, /^tbc$/i, /^n\/?a$/i, /^unknown$/i, /^-+$/];

function blank(v: string | null | undefined): boolean {
  const s = (v ?? "").trim();
  if (!s) return true;
  return PLACEHOLDERS.some((p) => p.test(s));
}

export type JobForGaps = {
  status: OrderStatus;
  address: string | null;
  suburb: string | null;
  /** Admin only. Undefined means "not read", which is not the same as zero. */
  quoteCents?: number;
  lineCount: number;
  customer: { name: string | null; phone: string | null; email: string | null };
};

/** Stages at which a site address and a cut list are genuinely expected. */
const NEEDS_SITE_DETAIL: readonly OrderStatus[] = [
  "MEASURED",
  "DETAILS",
  "FACTORY",
  "READY_FOR_DISPATCH",
  "INSTALLATION",
];

/**
 * What is missing, in the order someone would chase it.
 *
 * Which gaps count depends on the stage: a job at Initial or Quote Request is
 * allowed to have no address and no cut list, but one heading for the factory
 * needs both. Flagging an early enquiry for having no cut list would make the
 * board cry wolf, and a board that cries wolf gets ignored.
 */
export function gapsFor(job: JobForGaps): Gap[] {
  const gaps: Gap[] = [];
  const p = phase(job.status);
  if (p === "COMPLETE" || p === "LOST") return gaps;

  const won = p === "WON";
  const onSite = NEEDS_SITE_DETAIL.includes(job.status);

  if (blank(job.customer.name)) {
    gaps.push({ field: "name", label: "No customer name", blocking: true });
  }
  if (blank(job.customer.phone)) {
    gaps.push({ field: "phone", label: "No phone number", blocking: true });
  }
  if (blank(job.customer.email)) {
    gaps.push({ field: "email", label: "No email", blocking: false });
  }
  if (blank(job.suburb)) {
    gaps.push({ field: "suburb", label: "No suburb", blocking: won });
  }
  if (blank(job.address)) {
    // Only blocking once the order is active: before that there may genuinely
    // be no address, and the placeholder acceptBooking writes is honest.
    gaps.push({ field: "address", label: "No site address", blocking: won });
  }
  if (onSite && job.lineCount === 0) {
    gaps.push({ field: "lines", label: "Nothing on the cut list", blocking: true });
  }
  // Undefined means an employee is looking and money was never read. Absent is
  // not zero, and an employee must not be shown a money gap they cannot fix.
  if (job.quoteCents !== undefined && job.quoteCents <= 0 && job.status !== "INITIAL") {
    gaps.push({ field: "quote", label: "Not quoted", blocking: won });
  }

  return gaps;
}

export function gapTone(gaps: readonly Gap[]): Tone {
  if (gaps.some((g) => g.blocking)) return "late";
  return gaps.length ? "warn" : "ok";
}

// ------------------------------------------------------------------- a card

export type JobForBoard = JobForGaps & {
  id: string;
  jobNumber: string;
  pipeline: Pipeline;
  createdAt: Date;
  wonAt: Date | null;
  completedAt: Date | null;
  /**
   * When the job entered the stage it is in now, from its open OrderStage row.
   * Null only for a job with no history at all, which falls back to createdAt.
   */
  stageEnteredAt: Date | null;
  /**
   * The latest booked event. Only when even that one is behind us has the date
   * come and gone: a template done this morning with the install booked for
   * tomorrow is on track, not late.
   */
  lastEventAt: Date | null;
};

export type BoardCard = {
  id: string;
  jobNumber: string;
  pipeline: Pipeline;
  status: OrderStatus;
  customerName: string;
  suburb: string | null;
  daysInStage: number;
  ageTone: Tone;
  gaps: Gap[];
  gapTone: Tone;
  /** A booked date that has come and gone with the job unfinished. */
  datePassed: boolean;
  /** The worse of the signals. What the card's edge is coloured by. */
  tone: Tone;
};

/**
 * When the job entered its current stage.
 *
 * Read from the stage history, which is the record. The fallback to createdAt
 * covers a job written before the history table existed — it reads as "days
 * since the job arrived", which is wrong but never wildly so, and it stops a
 * card vanishing from the board because its history is missing.
 */
export function stageSince(job: Pick<JobForBoard, "stageEnteredAt" | "createdAt">): Date {
  return job.stageEnteredAt ?? job.createdAt;
}

export function toCard(job: JobForBoard, now = new Date()): BoardCard {
  const p = phase(job.status);
  const settled = p === "COMPLETE" || p === "LOST";

  // Whole days, floored: a job is not "1 day late" after 25 hours.
  const ms = Math.max(0, now.getTime() - stageSince(job).getTime());
  const daysInStage = Math.floor(ms / 86_400_000);

  const gaps = gapsFor(job);
  const datePassed =
    !settled && job.lastEventAt !== null && job.lastEventAt.getTime() < now.getTime();

  const age = ageTone(job.status, daysInStage);
  const gt = gapTone(gaps);

  return {
    id: job.id,
    jobNumber: job.jobNumber,
    pipeline: job.pipeline,
    status: job.status,
    customerName: job.customer.name ?? "—",
    suburb: job.suburb,
    daysInStage,
    ageTone: age,
    gaps,
    gapTone: gt,
    datePassed,
    tone: worst(age, gt, datePassed ? "late" : "ok"),
  };
}

// ------------------------------------------------------------------ columns

/**
 * The columns: every stage a job can still be sitting in.
 *
 * INVOICE is absent because a job that reaches it is finished, and LOST because
 * it is not a stage. Both would only ever read zero here.
 */
export const BOARD_STAGES: readonly OrderStatus[] = STAGES.filter((s) => s !== FINAL_STAGE);

export function columnsFor(): readonly OrderStatus[] {
  return BOARD_STAGES;
}

// ------------------------------------------------------------------ filters

export const BOARD_FILTERS = ["all", "attention", "late", "missing", "passed"] as const;
export type BoardFilter = (typeof BOARD_FILTERS)[number];

export const FILTER_LABEL: Record<BoardFilter, string> = {
  all: "Everything",
  attention: "Needs a look",
  late: "Overdue",
  missing: "Missing details",
  passed: "Date has passed",
};

export function isBoardFilter(v: unknown): v is BoardFilter {
  return typeof v === "string" && (BOARD_FILTERS as readonly string[]).includes(v);
}

export function matchesFilter(card: BoardCard, filter: BoardFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "attention":
      return card.tone !== "ok";
    case "late":
      return card.tone === "late";
    case "missing":
      return card.gaps.length > 0;
    case "passed":
      return card.datePassed;
  }
}

/** How many cards each filter would show, for the chip counts. */
export function filterCounts(cards: readonly BoardCard[]): Record<BoardFilter, number> {
  const out = {} as Record<BoardFilter, number>;
  for (const f of BOARD_FILTERS) out[f] = cards.filter((c) => matchesFilter(c, f)).length;
  return out;
}
