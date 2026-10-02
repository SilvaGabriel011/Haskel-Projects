"use server";

import { revalidatePath } from "next/cache";

import { workspaceDomain } from "@/lib/access-config";
import { record } from "@/lib/activity";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/guard";
import { validatePerson } from "@/lib/people";
import { hashPin, validPin } from "@/lib/pin";
import { isRole, type Role } from "@/lib/roles";

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

  // The type is only a promise the caller made; a server action takes anything.
  if (!isRole(role)) return { ok: false as const, reason: "That is not a role." };

  if (userId === me.id && role !== "ADMIN") {
    return { ok: false as const, reason: "You cannot take admin away from yourself." };
  }
  if (role !== "ADMIN" && (await wouldLeaveNoAdmin(userId))) {
    return { ok: false as const, reason: "That is the only admin left. Make someone else an admin first." };
  }

  const who = await db.user.update({ where: { id: userId }, data: { role }, select: { name: true, email: true } });
  await record(me, "person.role", `Made ${who.name} (${who.email}) ${role === "ADMIN" ? "an admin" : "an employee"}`, "/settings");
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

  const who = await db.user.update({ where: { id: userId }, data: { active }, select: { name: true, email: true } });
  await record(me, active ? "person.reactivated" : "person.deactivated", `${active ? "Reactivated" : "Deactivated"} ${who.name} (${who.email})`, "/settings");
  revalidatePath("/settings");
  return { ok: true as const };
}

/**
 * Someone new who can sign in: on a login of their own, or added to one
 * already in use, which makes it shared and needs a PIN (lib/people.ts).
 */
export async function addPerson(form: Record<string, unknown>) {
  const me = await requireAdmin();

  const email = typeof form.email === "string" ? form.email.trim().toLowerCase() : "";
  const onLogin = await db.user.findMany({ where: { email }, select: { name: true, pinHash: true, active: true } });
  const parsed = validatePerson(form, { domain: workspaceDomain(), namesOnLogin: onLogin.map((u) => u.name) });
  if (!parsed.ok) return parsed;
  const p = parsed.value;

  try {
    await db.user.create({
      data: { name: p.name, email: p.email, role: p.role, pinHash: p.pin ? hashPin(p.pin) : null },
    });
  } catch {
    return { ok: false as const, reason: `${p.name} is already on ${p.email}.` };
  }
  await record(me, "person.added", `Added ${p.name} as ${p.role === "ADMIN" ? "an admin" : "an employee"} on ${p.email}`, "/settings");
  revalidatePath("/settings");

  // Whoever was on the login alone before has no PIN, and now has to pick
  // themselves too.
  const withoutPin = onLogin.filter((u) => u.active && !u.pinHash).map((u) => u.name);
  return {
    ok: true as const,
    warning: withoutPin.length
      ? `${p.email} is now shared. Set a PIN for ${withoutPin.join(" and ")}, or they cannot pick themselves after signing in.`
      : null,
  };
}

/** Set or change someone's PIN. Clears any lock from wrong guesses. */
export async function setPin(userId: string, pin: string) {
  const me = await requireAdmin();
  if (!validPin(String(pin ?? ""))) return { ok: false as const, reason: "A PIN is 4 digits." };

  const who = await db.user.update({
    where: { id: String(userId) },
    data: { pinHash: hashPin(pin), pinFailures: 0, pinLockedUntil: null },
    select: { name: true, email: true },
  });
  await record(me, "person.pin", `Set a new PIN for ${who.name} (${who.email})`, "/settings");
  revalidatePath("/settings");
  return { ok: true as const };
}
