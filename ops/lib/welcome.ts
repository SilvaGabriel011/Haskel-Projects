/**
 * The first-login walkthrough at /welcome.
 *
 * Pure and free of the database, like lib/pipeline.ts, so who gets sent there
 * — and what each role is told about moving a job — is unit tested.
 */
import type { OrderStatus } from "@prisma/client";

import { STAGES, STAGE_LABEL, requiresAdmin } from "@/lib/pipeline";
import type { Role } from "@/lib/roles";

/**
 * Should opening the dashboard send this person to /welcome?
 *
 * Once, for someone who has not finished it. Never when they arrive carrying
 * ?denied: that is the page explaining why an admin-only link sent them back,
 * and sending them on again would swallow the explanation.
 */
export function needsWelcome(user: { onboardedAt: Date | null }, denied?: string): boolean {
  return user.onboardedAt === null && !denied;
}

/** What each stage means, in the words the walkthrough uses. */
export const STAGE_HELP: Record<Exclude<OrderStatus, "LOST">, string> = {
  INITIAL: "A new enquiry. Accepted website bookings start here.",
  QUOTE_REQUEST: "The customer wants a price.",
  QUOTED: "The price has gone to the customer.",
  ORDER_ACTIVE: "The customer said yes — the job is won.",
  PURCHASE_ORDER: "Stone is ordered for it.",
  MEASURED: "The site has been measured.",
  DETAILS: "Cut list and details are worked out.",
  FACTORY: "Being cut and finished.",
  READY_FOR_DISPATCH: "Finished, waiting to go out.",
  INSTALLATION: "Going in on site.",
  INVOICE: "Billed. The job is complete.",
};

export type WelcomeStage = {
  number: number;
  status: OrderStatus;
  label: string;
  help: string;
  /** Can this person move a job into this stage? */
  canMove: boolean;
};

/**
 * The eleven stages as this person should learn them.
 *
 * Read from lib/pipeline rather than restated, so the walkthrough can never
 * tell an installer they may do something the server will refuse.
 */
export function stagesFor(role: Role): WelcomeStage[] {
  return STAGES.map((status, i) => ({
    number: i + 1,
    status,
    label: STAGE_LABEL[status],
    help: STAGE_HELP[status as Exclude<OrderStatus, "LOST">],
    // The first stage is where a job is created, not a move anyone makes.
    canMove: i === 0 ? role === "ADMIN" : role === "ADMIN" || !requiresAdmin(status),
  }));
}
