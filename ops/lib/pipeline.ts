/**
 * The eleven stages every job runs, and the rules for moving between them.
 *
 * This replaced a two-pipeline design (a short run for offcut work, a long one
 * for benchtop installs). One flow for everything is simpler to read and makes
 * every job's timings comparable — the cost is that an offcut vanity top still
 * passes through Purchase Order and Factory, which on small work are often a
 * few minutes each.
 *
 * `pipeline` survives on the Order as a classification, not a stage list: the
 * financials still split revenue between offcut/small work and benchtop
 * installs, which is the split the business runs on.
 */
import type { OrderStatus, Pipeline } from "@prisma/client";

/** Legal stage order. Index position is the progression. */
export const STAGES: readonly OrderStatus[] = [
  "INITIAL",
  "QUOTE_REQUEST",
  "QUOTED",
  "ORDER_ACTIVE",
  "PURCHASE_ORDER",
  "MEASURED",
  "DETAILS",
  "FACTORY",
  "READY_FOR_DISPATCH",
  "INSTALLATION",
  "INVOICE",
] as const;

/** The last stage. A job here is finished. */
export const FINAL_STAGE: OrderStatus = "INVOICE";

/** Statuses a job can be abandoned from — before any money has been committed. */
const LOSABLE_FROM: readonly OrderStatus[] = ["INITIAL", "QUOTE_REQUEST", "QUOTED"];

/** 1-based position, as the stage dots are numbered on screen. */
export function stageNumber(status: OrderStatus): number | null {
  const i = STAGES.indexOf(status);
  return i === -1 ? null : i + 1;
}

/** The coarse buckets the financials group by. */
export type Phase = "OPEN" | "WON" | "COMPLETE" | "LOST";

export function phase(status: OrderStatus): Phase {
  if (status === "LOST") return "LOST";
  if (status === FINAL_STAGE) return "COMPLETE";
  // A job is won once it is active — that is the point an order exists rather
  // than a quote someone may never accept.
  return STAGES.indexOf(status) >= STAGES.indexOf("ORDER_ACTIVE") ? "WON" : "OPEN";
}

/** Is this a real stage (rather than LOST, or a value from an older schema)? */
export function isStage(status: OrderStatus): boolean {
  return STAGES.includes(status);
}

/** Kept for the queries that still ask; every job now runs every stage. */
export function belongsTo(_pipeline: Pipeline, status: OrderStatus): boolean {
  return status === "LOST" || isStage(status);
}

/** The next stage, or null at the end of the run. */
export function nextStage(status: OrderStatus): OrderStatus | null {
  const i = STAGES.indexOf(status);
  if (i === -1 || i === STAGES.length - 1) return null;
  return STAGES[i + 1];
}

export type TransitionResult = { ok: true } | { ok: false; reason: string };

/**
 * May this order move from `from` to `to`?
 *
 * Forward one step, or out to LOST from an early stage. Anything else — a
 * skipped step, a jump backwards, a move off a finished job — is refused with a
 * reason the UI can show.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): TransitionResult {
  if (from === to) return { ok: false, reason: "That is already the stage." };

  if (from === "LOST") return { ok: false, reason: "A lost job cannot be moved on." };
  if (from === FINAL_STAGE) {
    return { ok: false, reason: `${STAGE_LABEL[FINAL_STAGE]} is the last stage.` };
  }

  if (to === "LOST") {
    return LOSABLE_FROM.includes(from)
      ? { ok: true }
      : { ok: false, reason: "A job can only be marked lost before the order is active." };
  }

  if (!isStage(to)) return { ok: false, reason: `${to} is not a stage.` };

  const expected = nextStage(from);
  if (expected !== to) {
    return {
      ok: false,
      reason: expected
        ? `The next stage is ${STAGE_LABEL[expected]}, not ${STAGE_LABEL[to]}.`
        : `${STAGE_LABEL[from]} is the last stage.`,
    };
  }

  return { ok: true };
}

/**
 * Stages only an admin may set.
 *
 * An installer moves work along the bench — measured, details, factory, out the
 * door, installed. What a job is worth, whether to order stone for it, and
 * whether to write it off stay with the office.
 */
const ADMIN_ONLY_STAGES: readonly OrderStatus[] = [
  "QUOTED",
  "ORDER_ACTIVE",
  "PURCHASE_ORDER",
  "INVOICE",
  "LOST",
];

export function requiresAdmin(to: OrderStatus): boolean {
  return ADMIN_ONLY_STAGES.includes(to);
}

/** Human labels. The UI should never show a raw enum. */
export const STAGE_LABEL: Record<OrderStatus, string> = {
  INITIAL: "Initial Stage",
  QUOTE_REQUEST: "Quote Request",
  QUOTED: "Quoted",
  ORDER_ACTIVE: "Order Active",
  PURCHASE_ORDER: "Purchase Order",
  MEASURED: "Measured",
  DETAILS: "Details",
  FACTORY: "Factory",
  READY_FOR_DISPATCH: "Ready For Dispatch",
  INSTALLATION: "Installation",
  INVOICE: "Invoice",
  LOST: "Lost",
};

/** The old name, kept so callers reading a status label need no change. */
export const STATUS_LABEL = STAGE_LABEL;

export const PIPELINE_LABEL: Record<Pipeline, string> = {
  SHORT: "Offcut & small jobs",
  FULL: "Benchtop installs",
};
