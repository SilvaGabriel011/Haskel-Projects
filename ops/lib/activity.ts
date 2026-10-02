/**
 * The record of who did what.
 *
 * Every action worth keeping gets one row with two labels: the owner, the
 * login that was signed in (info@… on a shared login), and the user, the
 * person on it who did it. On a login of one's own the two are the same
 * person. Settings shows the latest; nothing here is ever edited.
 *
 * Written straight after the change it describes. A failure to write the
 * record is logged and does not undo the work: the job is still opened, the
 * stock still added.
 */
import { db } from "@/lib/db";

export type Actor = { id: string; name: string; owner: string };

export async function record(actor: Actor, action: string, summary: string, href?: string): Promise<void> {
  try {
    await db.activity.create({
      data: {
        ownerEmail: actor.owner.toLowerCase(),
        userId: actor.id,
        userName: actor.name,
        action,
        summary: summary.slice(0, 300),
        href: href ?? null,
      },
    });
  } catch (e) {
    console.error("[activity]", action, e);
  }
}

export async function recentActivity(take = 50) {
  return db.activity.findMany({
    orderBy: { at: "desc" },
    take,
    select: { id: true, at: true, ownerEmail: true, userName: true, action: true, summary: true, href: true },
  });
}
