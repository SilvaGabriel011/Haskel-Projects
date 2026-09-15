/**
 * The two pipelines, and the one thing that keeps them comparable.
 *
 * Offcut and small jobs run SHORT; benchtop installs run FULL. They are rows in
 * the same table with the same status enum, so a single query can still report
 * across both — which is the cost that choosing two pipelines would otherwise
 * have imposed on the financials.
 *
 * `phase()` is the bridge: every status in either pipeline collapses onto one of
 * four coarse phases, and phase 6 groups by that.
 */
import type { OrderStatus, Pipeline } from "@prisma/client";

/** Legal stage order, per pipeline. Index position is the progression. */
export const STAGES: Record<Pipeline, readonly OrderStatus[]> = {
  SHORT: ["ENQUIRY", "QUOTED", "WON", "CUTTING", "COMPLETE"],
  FULL: [
    "ENQUIRY",
    "QUOTED",
    "WON",
    "TEMPLATED",
    "FABRICATING",
    "SCHEDULED",
    "INSTALLED",
    "COMPLETE",
  ],
} as const;

/** Statuses a job can be abandoned from, in either pipeline. */
const LOSABLE_FROM: readonly OrderStatus[] = ["ENQUIRY", "QUOTED"];

/** The coarse buckets both pipelines share. Financials group by these. */
export type Phase = "OPEN" | "WON" | "COMPLETE" | "LOST";

export function phase(status: OrderStatus): Phase {
  if (status === "LOST") return "LOST";
  if (status === "COMPLETE") return "COMPLETE";
  if (status === "ENQUIRY" || status === "QUOTED") return "OPEN";
  return "WON";
}

/** Is this status part of this pipeline at all? */
export function belongsTo(pipeline: Pipeline, status: OrderStatus): boolean {
  return status === "LOST" || STAGES[pipeline].includes(status);
}

/** The next stage, or null at the end of the run. */
export function nextStage(pipeline: Pipeline, status: OrderStatus): OrderStatus | null {
  const stages = STAGES[pipeline];
  const i = stages.indexOf(status);
  if (i === -1 || i === stages.length - 1) return null;
  return stages[i + 1];
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

/**
 * May this order move from `from` to `to`?
 *
 * Forward one step, or out to LOST from an early stage. Anything else — a stage
 * from the other pipeline, a skipped step, a jump backwards — is refused with a
 * reason the UI can show.
 */
export function canTransition(
  pipeline: Pipeline,
  from: OrderStatus,
  to: OrderStatus,
): TransitionResult {
  if (from === to) return { ok: false, reason: "That is already the status." };

  if (from === "LOST" || from === "COMPLETE") {
    return { ok: false, reason: `A ${from.toLowerCase()} job cannot be moved on.` };
  }

  if (to === "LOST") {
    return LOSABLE_FROM.includes(from)
      ? { ok: true }
      : { ok: false, reason: "A job can only be marked lost before it is won." };
  }

  if (!belongsTo(pipeline, to)) {
    const other: Pipeline = pipeline === "SHORT" ? "FULL" : "SHORT";
    return {
      ok: false,
      reason: STAGES[other].includes(to)
        ? `${to} belongs to the ${other.toLowerCase()} pipeline, not this one.`
        : `${to} is not a stage in this pipeline.`,
    };
  }

  const expected = nextStage(pipeline, from);
  if (expected !== to) {
    return {
      ok: false,
      reason: expected
        ? `The next stage is ${expected}, not ${to}.`
        : `${from} is the last stage.`,
    };
  }

  return { ok: true };
}

/** Human labels. The UI should never show a raw enum. */
export const STATUS_LABEL: Record<OrderStatus, string> = {
  ENQUIRY: "Enquiry",
  QUOTED: "Quoted",
  WON: "Won",
  CUTTING: "Cutting",
  TEMPLATED: "Templated",
  FABRICATING: "Fabricating",
  SCHEDULED: "Scheduled",
  INSTALLED: "Installed",
  COMPLETE: "Complete",
  LOST: "Lost",
};

export const PIPELINE_LABEL: Record<Pipeline, string> = {
  SHORT: "Offcut & small jobs",
  FULL: "Benchtop installs",
};
