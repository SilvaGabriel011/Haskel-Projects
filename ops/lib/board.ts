/**
 * The follow-up board: which jobs need chasing, and why.
 *
 * `/orders` answers "where is everything". This answers the different question
 * of "what is going wrong" — a job sitting too long in one stage, an install
 * date that has passed, or a customer record too thin to actually do the work.
 *
 * Pure and free of the database, like lib/pipeline.ts, so the thresholds and
 * the traffic lights are unit tested rather than only eyeballed on screen.
 *
 * Days are counted in the business's zone via lib/business-time, never by
 * dividing milliseconds: across a daylight saving change a "day" is 23 or 25
 * hours, and a job should not go amber an hour early in October.
 */
import type { OrderStatus, Pipeline } from "@prisma/client";

import { daysBetween } from "@/lib/business-time";
import { STAGES, phase } from "@/lib/pipeline";

/** Green, amber, red. Ordered, so the worst of several is just a max. */
export const TONES = ["ok", "warn", "late"] as const;
export type Tone = (typeof TONES)[number];

const RANK: Record<Tone, number> = { ok: 0, warn: 1, late: 2 };

export function worst(...tones: Tone[]): Tone {
  return tones.reduce((a, b) => (RANK[b] > RANK[a] ? b : a), "ok");
}

export const TONE_LABEL: Record<Tone, string> = {
  ok: "On track",
  warn: "Getting on",
  late: "Overdue",
};

/**
 * How many days a job may sit in a stage before it is worth a look, then
 * before it is late.
 *
 * Per stage, because the stages are not alike: an enquiry left three days is
 * a lost customer, while fabrication legitimately takes a fortnight. These are
 * a starting point — they are the numbers most likely to want tuning once the
 * business has watched the board for a month.
 */
export const STAGE_DAYS: Record<OrderStatus, { warn: number; late: number }> = {
  ENQUIRY: { warn: 2, late: 4 },
  QUOTED: { warn: 5, late: 10 },
  WON: { warn: 5, late: 10 },
  CUTTING: { warn: 4, late: 8 },
  TEMPLATED: { warn: 7, late: 14 },
  FABRICATING: { warn: 10, late: 18 },
  SCHEDULED: { warn: 10, late: 21 },
  INSTALLED: { warn: 3, late: 7 },
  COMPLETE: { warn: Infinity, late: Infinity },
  LOST: { warn: Infinity, late: Infinity },
};

export function ageTone(status: OrderStatus, days: number): Tone {
  const t = STAGE_DAYS[status];
  if (days >= t.late) return "late";
  if (days >= t.warn) return "warn";
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

/**
 * What is missing, in the order someone would chase it.
 *
 * Which gaps count depends on the stage: a fresh enquiry is allowed to have no
 * address and no quote, but a job that has been won and is not yet complete
 * needs both. Flagging an enquiry for having no cut list would make the board
 * cry wolf, and a board that cries wolf gets ignored.
 */
export function gapsFor(job: JobForGaps): Gap[] {
  const gaps: Gap[] = [];
  const p = phase(job.status);
  const settled = p === "COMPLETE" || p === "LOST";
  if (settled) return gaps;

  const won = p === "WON";

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
    // Only blocking once the job is won: before that there may genuinely be no
    // address yet, and the placeholder acceptBooking writes is honest.
    gaps.push({ field: "address", label: "No site address", blocking: won });
  }
  if (won && job.lineCount === 0) {
    gaps.push({ field: "lines", label: "Nothing on the cut list", blocking: true });
  }
  // Undefined means an employee is looking and money was never read. Absent is
  // not zero, and an employee must not be shown a money gap they cannot fix.
  if (job.quoteCents !== undefined && job.quoteCents <= 0 && job.status !== "ENQUIRY") {
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
  /** Soonest booked event still ahead, and the last one behind. */
  nextEventAt: Date | null;
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
  /** The worse of the two signals. What the card's edge is coloured by. */
  tone: Tone;
};

/**
 * When the job last moved.
 *
 * There is no per-stage history table, so this is the best timestamp available
 * for the stage it is in: `wonAt` once it is won, `createdAt` before that. It
 * therefore reads "days since it was won" for every post-win stage rather than
 * days in that exact stage — which is honest for chasing, and the alternative
 * is a status-history table that is not worth adding until asked for.
 */
export function stageSince(job: Pick<JobForBoard, "status" | "createdAt" | "wonAt">): Date {
  const p = phase(job.status);
  if ((p === "WON" || p === "COMPLETE") && job.wonAt) return job.wonAt;
  return job.createdAt;
}

export function toCard(job: JobForBoard, now = new Date()): BoardCard {
  const settled = phase(job.status) === "COMPLETE" || phase(job.status) === "LOST";
  const daysInStage = Math.max(0, daysBetween(stageSince(job), now));
  const gaps = gapsFor(job);

  const datePassed =
    !settled && job.nextEventAt !== null && job.nextEventAt.getTime() < now.getTime();

  const age = settled ? "ok" : ageTone(job.status, daysInStage);
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
 * The columns, in the order work actually progresses.
 *
 * Not the union of both pipelines' stage lists: concatenating them puts
 * CUTTING — the short pipeline's only post-win stage — after INSTALLED, which
 * reads as though offcut jobs are cut last. Interleaved by hand instead,
 * because the two pipelines diverge after WON and rejoin at COMPLETE.
 *
 * COMPLETE and LOST are absent on purpose: this board is what still needs
 * doing, so those columns would always be empty.
 */
export const BOARD_STAGES: readonly OrderStatus[] = [
  "ENQUIRY",
  "QUOTED",
  "WON",
  "CUTTING",
  "TEMPLATED",
  "FABRICATING",
  "SCHEDULED",
  "INSTALLED",
] as const;

/** The columns to show, for one pipeline or for both. */
export function columnsFor(pipeline?: Pipeline): readonly OrderStatus[] {
  if (!pipeline) return BOARD_STAGES;
  const inThis = new Set<OrderStatus>(STAGES[pipeline]);
  return BOARD_STAGES.filter((s) => inThis.has(s));
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
