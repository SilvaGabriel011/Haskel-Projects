/**
 * How long a job spent in each stage.
 *
 * Status alone says where a job is, never how long it has been there — which is
 * the whole question the follow-up board and the timeline exist to answer. The
 * OrderStage rows are the record; everything here is arithmetic over them, kept
 * pure so the thresholds and the roll-ups are unit tested rather than eyeballed.
 *
 * Hours are calendar time, not working time. A job sitting over a weekend has
 * genuinely sat over the weekend, and pretending otherwise flatters the numbers.
 */
import type { OrderStatus } from "@prisma/client";

import { STAGES, STAGE_LABEL } from "@/lib/pipeline";

/** The colours on the timeline. Ordered, so the worst of several is a max. */
export const TIMING_TONES = ["ok", "over3", "over5", "live"] as const;
export type TimingTone = (typeof TIMING_TONES)[number];

export const TIMING_LABEL: Record<TimingTone, string> = {
  ok: "Within target",
  over3: "Over 3 days",
  over5: "Over 5 days",
  live: "Current stage",
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** One flat pair of thresholds for every stage, as the timeline legend states. */
export const OVER_3_DAYS_MS = 3 * DAY;
export const OVER_5_DAYS_MS = 5 * DAY;

export function toneForMs(ms: number, live = false): TimingTone {
  if (live) return "live";
  if (ms >= OVER_5_DAYS_MS) return "over5";
  if (ms >= OVER_3_DAYS_MS) return "over3";
  return "ok";
}

export type StageRow = {
  stage: OrderStatus;
  enteredAt: Date;
  exitedAt: Date | null;
  movedBy?: { name: string } | null;
};

export type StageSpell = {
  stage: OrderStatus;
  label: string;
  /** 1-based, as the dots are numbered. */
  number: number;
  enteredAt: Date;
  exitedAt: Date | null;
  ms: number;
  hours: number;
  days: number;
  /** "7 min", "1.2 days" — the second line under the hours. */
  human: string;
  live: boolean;
  tone: TimingTone;
  movedBy: string | null;
};

export type StageTimeline = {
  spells: StageSpell[];
  /** Every stage in order, including ones not started. */
  all: Array<{ stage: OrderStatus; label: string; number: number; spell: StageSpell | null }>;
  totalMs: number;
  totalHours: number;
  totalDays: number;
  completed: number;
  ofStages: number;
  current: StageSpell | null;
  longest: StageSpell | null;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A duration as a person would say it.
 *
 * Minutes below an hour, because several of these stages are a click apart and
 * "0.0 days" tells nobody anything.
 */
export function humanDuration(ms: number): string {
  if (ms < HOUR) {
    const mins = Math.max(0, Math.round(ms / 60_000));
    return `${mins} min`;
  }
  if (ms < DAY) {
    const hours = round1(ms / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"}`;
  }
  const days = round1(ms / DAY);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

/** Hours to one decimal, the headline figure on each dot. */
export const hoursOf = (ms: number) => round1(ms / HOUR);

/**
 * Turn the stored spells into everything the timeline shows.
 *
 * Rows are taken in the order given; a job that went back and forth would have
 * more than one spell in a stage, and each is kept rather than summed, because
 * "it sat in Factory twice" is the interesting fact.
 */
export function buildTimeline(rows: readonly StageRow[], now = new Date()): StageTimeline {
  const spells: StageSpell[] = rows.map((r) => {
    const live = r.exitedAt === null;
    const end = r.exitedAt ?? now;
    const ms = Math.max(0, end.getTime() - r.enteredAt.getTime());
    const number = STAGES.indexOf(r.stage) + 1;
    return {
      stage: r.stage,
      label: STAGE_LABEL[r.stage],
      number: number || STAGES.length + 1, // LOST sorts last
      enteredAt: r.enteredAt,
      exitedAt: r.exitedAt,
      ms,
      hours: hoursOf(ms),
      days: round1(ms / DAY),
      human: humanDuration(ms),
      live,
      tone: toneForMs(ms, live),
      movedBy: r.movedBy?.name ?? null,
    };
  });

  const totalMs = spells.reduce((t, s) => t + s.ms, 0);
  const current = spells.find((s) => s.live) ?? null;

  // The longest is about where time actually went, so a stage still running
  // counts: "it has been in Factory for six days" is the point, not a footnote.
  const longest = spells.reduce<StageSpell | null>(
    (best, s) => (best === null || s.ms > best.ms ? s : best),
    null,
  );

  const finished = new Set(spells.filter((s) => !s.live).map((s) => s.stage));

  const all = STAGES.map((stage, i) => ({
    stage,
    label: STAGE_LABEL[stage],
    number: i + 1,
    // The latest spell in this stage, which is the one worth showing.
    spell: [...spells].reverse().find((s) => s.stage === stage) ?? null,
  }));

  return {
    spells,
    all,
    totalMs,
    totalHours: hoursOf(totalMs),
    totalDays: round1(totalMs / DAY),
    completed: finished.size,
    ofStages: STAGES.length,
    current,
    longest,
  };
}

/**
 * The stacked bar: each stage's share of the total.
 *
 * Shares are computed from the raw milliseconds and only then rounded, so they
 * still add to roughly 100 — rounding each stage first drifts by several points
 * over eleven of them. A band narrower than a tenth of the bar goes unlabelled:
 * "Purchase Order" in a 4% band wraps and collides with its neighbours, and the
 * hover title carries the name anyway.
 */
export type TimeShare = {
  stage: OrderStatus;
  label: string;
  pct: number;
  showLabel: boolean;
  tone: TimingTone;
};

export function timeShares(timeline: StageTimeline): TimeShare[] {
  if (timeline.totalMs <= 0) return [];
  return timeline.spells.map((s) => {
    const pct = (s.ms / timeline.totalMs) * 100;
    return {
      stage: s.stage,
      label: s.label,
      pct: Math.round(pct * 10) / 10,
      showLabel: pct >= 10,
      tone: s.tone,
    };
  });
}
