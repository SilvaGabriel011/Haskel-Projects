"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import type { Role } from "@/lib/roles";

/**
 * Changing who can see what.
 *
 * Every action here re-asserts admin on the server. The route guard already
 * blocks an employee from reaching /settings, but a server action is its own
 * endpoint — it can be invoked without ever loading the page, so it cannot
 * lean on the page's guard.
 */

/** You cannot remove the last admin, or you lock everyone out of the money. */
async function wouldLeaveNoAdmin(userId: string): Promise<boolean> {
  const others = await db.user.count({
    where: { role: "ADMIN", active: true, id: { not: userId } },
  });
  return others === 0;
}

export async function setRole(userId: string, role: Role) {
  const me = await requireAdmin();

  if (userId === me.id && role !== "ADMIN") {
    return { ok: false as const, reason: "You cannot take admin away from yourself." };
  }
  if (role !== "ADMIN" && (await wouldLeaveNoAdmin(userId))) {
    return { ok: false as const, reason: "That is the only admin left. Make someone else an admin first." };
  }

  await db.user.update({ where: { id: userId }, data: { role } });
  revalidatePath("/settings");
  return { ok: true as const };
}

export async function setActive(userId: string, active: boolean) {
  const me = await requireAdmin();

  if (userId === me.id && !active) {
    return { ok: false as const, reason: "You cannot deactivate yourself." };
  }
  if (!active && (await wouldLeaveNoAdmin(userId))) {
    return { ok: false as const, reason: "That is the only admin left. Make someone else an admin first." };
  }

  await db.user.update({ where: { id: userId }, data: { active } });
  revalidatePath("/settings");
  return { ok: true as const };
}
