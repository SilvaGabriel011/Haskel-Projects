/**
 * Adding a person who can sign in, on a login of their own or a shared one.
 *
 * A login is the Google account (the email). Putting a second person on a
 * login makes it shared: from then on each person on it picks themselves
 * after signing in, with a PIN, so everyone on a shared login needs one.
 *
 * Pure, so the rules are unit tested; Settings does the writing.
 */
import { emailOnDomain } from "@/lib/access-config";
import { validPin } from "@/lib/pin";
import { isRole, type Role } from "@/lib/roles";

export type NewPerson = { name: string; email: string; role: Role; pin: string | null };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function validatePerson(
  f: Record<string, unknown>,
  ctx: { domain: string | null; namesOnLogin: readonly string[] },
): { ok: true; value: NewPerson } | { ok: false; reason: string } {
  const name = str(f.name).replace(/\s+/g, " ");
  if (name.length < 2 || name.length > 80) return { ok: false, reason: "Give their name." };

  const email = str(f.email).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) {
    return { ok: false, reason: "Give the email they sign in with." };
  }
  if (ctx.domain && !emailOnDomain(email, ctx.domain)) {
    return { ok: false, reason: `Only @${ctx.domain} accounts can sign in.` };
  }

  const role = str(f.role);
  if (!isRole(role)) return { ok: false, reason: "Pick admin or employee." };

  if (ctx.namesOnLogin.some((n) => n.toLowerCase() === name.toLowerCase())) {
    return { ok: false, reason: `${name} is already on ${email}.` };
  }

  // Joining someone makes the login shared, and on a shared login the PIN is
  // how they say who they are.
  const pin = str(f.pin);
  const shared = ctx.namesOnLogin.length > 0;
  if (shared && !validPin(pin)) {
    return { ok: false, reason: `${email} is already used by ${ctx.namesOnLogin.join(", ")}, so ${name} needs a 4-digit PIN.` };
  }
  if (pin && !validPin(pin)) return { ok: false, reason: "A PIN is 4 digits." };

  return { ok: true, value: { name, email, role, pin: pin || null } };
}
