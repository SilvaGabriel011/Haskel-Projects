"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { CURRENT } from "@/lib/releases";

/**
 * "Got it" on the What's new card: they have now seen this release.
 *
 * Marks only the person signed in, and only ever with the current version,
 * whatever the request says.
 */
export async function dismissWhatsNew() {
  const me = await requireUser();
  await db.user.update({ where: { id: me.id }, data: { seenVersion: CURRENT.version } });
  revalidatePath("/dashboard");
}
