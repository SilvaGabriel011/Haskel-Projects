"use server";

import { redirect } from "next/navigation";

import { auth, unstable_update } from "@/auth";
import { record } from "@/lib/activity";
import { db } from "@/lib/db";
import { PIN_LOCK_MS, checkPin, makePickTicket, wrongPinMessage } from "@/lib/pin";
import { completePinReset, requestPinReset } from "@/lib/pin-reset";

/**
 * Pick yourself on a shared login, with your PIN.
 *
 * Only someone on the login that is signed in can be picked, whatever id the
 * form sends; the session is then updated through a signed ticket.
 */
export async function pickPerson(personId: string, pin: string): Promise<{ ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const owner = session.user.owner;

  const person = await db.user.findFirst({
    where: { id: String(personId), email: owner, active: true },
    select: { id: true, name: true, pinHash: true, pinLockedUntil: true },
  });
  if (!person) return { ok: false, reason: "Pick someone on this login." };

  const check = checkPin(person, String(pin ?? "").trim());
  if (!check.ok) {
    if (!check.wrong) return { ok: false, reason: check.reason };
    const { pinFailures } = await db.user.update({
      where: { id: person.id },
      data: { pinFailures: { increment: 1 } },
      select: { pinFailures: true },
    });
    const message = wrongPinMessage(person.name, pinFailures);
    if (message.lock) {
      await db.user.update({
        where: { id: person.id },
        data: { pinFailures: 0, pinLockedUntil: new Date(Date.now() + PIN_LOCK_MS) },
      });
    }
    return { ok: false, reason: message.reason };
  }

  await db.user.update({ where: { id: person.id }, data: { pinFailures: 0, pinLockedUntil: null } });
  // The session endpoint takes arbitrary data; jwt in auth.ts only acts on a
  // ticket it can verify, so this is the only way in.
  await unstable_update({ pickTicket: makePickTicket(person.id, owner) } as never);
  await record({ id: person.id, name: person.name, owner }, "signed.in", `Signed in on ${owner}`);
  redirect("/dashboard");
}

/** Hand the shared login to someone else without signing out of Google. */
export async function switchPerson() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await unstable_update({ switchPerson: true } as never);
  redirect("/who");
}

/** "Forgot PIN?": email a one-time code to this login for the person picked. */
export async function forgotPin(personId: string) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return requestPinReset(session.user.owner, String(personId));
}

/** The code from the email and a new PIN: set it, and carry on as that person. */
export async function resetPinWithCode(personId: string, code: string, pin: string): Promise<{ ok: false; reason: string }> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const owner = session.user.owner;

  const res = await completePinReset(owner, String(personId), String(code ?? ""), String(pin ?? ""));
  if (!res.ok) return res;

  await unstable_update({ pickTicket: makePickTicket(res.personId, owner) } as never);
  await record({ id: res.personId, name: res.name, owner }, "person.pin.reset", `Reset their PIN with a code emailed to ${owner}`);
  redirect("/dashboard");
}
