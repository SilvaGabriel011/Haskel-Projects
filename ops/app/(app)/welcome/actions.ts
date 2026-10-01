"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { CURRENT } from "@/lib/releases";

/**
 * Finish the walkthrough and go to work.
 *
 * Only ever marks the signed-in person — the id comes from their session,
 * never from the request — and only the first time, so revisiting /welcome
 * later from the sidebar does not move the date.
 */
export async function finishWelcome() {
  const me = await requireUser();
  await db.user.updateMany({
    where: { id: me.id, onboardedAt: null },
    // The walkthrough covers what is current, so there is nothing "new" to
    // tell them on the dashboard straight after.
    data: { onboardedAt: new Date(), seenVersion: CURRENT.version },
  });
  redirect("/dashboard");
}
