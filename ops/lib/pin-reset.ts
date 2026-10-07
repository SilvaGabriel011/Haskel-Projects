/**
 * "Forgot PIN?" on a shared login.
 *
 * A 6-digit one-time code goes to the login's own inbox (info@…). Whoever can
 * read that inbox already controls the login, so the code proves enough to
 * set a new PIN. The code is stored hashed, lasts 10 minutes, allows 5 tries,
 * and a new one can be sent at most once a minute. Setting the new PIN also
 * lifts any lock from wrong PINs.
 */
import { randomInt } from "node:crypto";

import { db } from "@/lib/db";
import { sendMail, type Fetch } from "@/lib/mail";
import { hashPassword, verifyPassword } from "@/lib/password";
import { hashPin, validPin } from "@/lib/pin";

export const CODE_MS = 10 * 60 * 1000;
export const CODE_TRIES = 5;
export const RESEND_GAP_MS = 60 * 1000;

const person = (owner: string, id: string) =>
  db.user.findFirst({
    where: { id, email: owner.toLowerCase(), active: true },
    select: { id: true, name: true, email: true, pinResetHash: true, pinResetExpires: true, pinResetTries: true, pinResetSentAt: true },
  });

export type ResetResult = { ok: true; sentTo: string } | { ok: false; reason: string };

/** Email a code to the login, for this person on it. */
export async function requestPinReset(
  owner: string,
  personId: string,
  opts: { now?: Date; fetchFn?: Fetch } = {},
): Promise<ResetResult> {
  const now = opts.now ?? new Date();
  const p = await person(owner, personId);
  if (!p) return { ok: false, reason: "Pick someone on this login." };
  if (p.pinResetSentAt && now.getTime() - p.pinResetSentAt.getTime() < RESEND_GAP_MS) {
    return { ok: false, reason: "A code was sent less than a minute ago. Check the inbox, or wait a minute." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const sent = await sendMail(
    {
      to: p.email,
      subject: `Haskel Ops: code to reset ${p.name}'s PIN`,
      text: [
        `Someone asked to reset ${p.name}'s PIN on ${p.email}.`,
        "",
        `Code: ${code}`,
        "",
        "It works for 10 minutes. If this was not you, ignore this email: the PIN stays as it is.",
      ].join("\n"),
    },
    opts.fetchFn,
  );
  if (!sent.ok) {
    return {
      ok: false,
      reason:
        sent.reason === "not-configured"
          ? "Email is not set up yet, so no code can be sent. Ask an admin to set your PIN in Settings."
          : `The code could not be sent (${sent.detail}). Try again, or ask an admin to set your PIN.`,
    };
  }

  await db.user.update({
    where: { id: p.id },
    data: { pinResetHash: hashPassword(code), pinResetExpires: new Date(now.getTime() + CODE_MS), pinResetTries: 0, pinResetSentAt: now },
  });
  return { ok: true, sentTo: p.email };
}

export type CompleteResult = { ok: true; personId: string; name: string } | { ok: false; reason: string };

/** Check the code and set the new PIN. */
export async function completePinReset(
  owner: string,
  personId: string,
  code: string,
  newPin: string,
  now = new Date(),
): Promise<CompleteResult> {
  if (!validPin(newPin)) return { ok: false, reason: "The new PIN must be 4 digits." };
  const p = await person(owner, personId);
  if (!p) return { ok: false, reason: "Pick someone on this login." };
  if (!p.pinResetHash || !p.pinResetExpires || p.pinResetExpires <= now || p.pinResetTries >= CODE_TRIES) {
    return { ok: false, reason: "That code has expired or been used up. Send a new one." };
  }

  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean) || !verifyPassword(clean, p.pinResetHash)) {
    // Counted atomically: two guesses at once both count.
    const { pinResetTries } = await db.user.update({
      where: { id: p.id },
      data: { pinResetTries: { increment: 1 } },
      select: { pinResetTries: true },
    });
    const left = CODE_TRIES - pinResetTries;
    return {
      ok: false,
      reason: left > 0 ? `Wrong code. ${left} more ${left === 1 ? "try" : "tries"}.` : "Wrong code, and that was the last try. Send a new one.",
    };
  }

  // One use only: the code is cleared with the PIN set.
  await db.user.update({
    where: { id: p.id },
    data: {
      pinHash: hashPin(newPin),
      pinFailures: 0,
      pinLockedUntil: null,
      pinResetHash: null,
      pinResetExpires: null,
      pinResetTries: 0,
    },
  });
  return { ok: true, personId: p.id, name: p.name };
}
