/**
 * Picking yourself on a shared login.
 *
 * Several people can sign in with one email (info@…). Google proves the login;
 * a 4-digit PIN proves which person on it is at the keyboard, so the "user"
 * on every record can be trusted and each person keeps their own role.
 *
 * Five wrong PINs in a row lock that person's picking for 15 minutes: four
 * digits are only 10,000 guesses, so guessing must be slow.
 *
 * The pick reaches the session as a short-lived ticket signed with
 * AUTH_SECRET. The session endpoint accepts updates from the browser, so a
 * bare "I am person X" there would be a way round the PIN; a ticket only the
 * server can sign is not.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

import { hashPassword, verifyPassword } from "@/lib/password";

export const PIN_TRIES = 5;
export const PIN_LOCK_MS = 15 * 60 * 1000;
const TICKET_MS = 60 * 1000;

/** Four digits, nothing else. */
export function validPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

export const hashPin = (pin: string) => hashPassword(pin);

export type PinState = { name: string; pinHash: string | null; pinLockedUntil: Date | null };

export type PinCheck = { ok: true } | { ok: false; reason: string; wrong: boolean };

/**
 * Check a PIN. A wrong one is counted by the caller with an atomic increment
 * (two guesses at once must both count), then worded by wrongPinMessage.
 */
export function checkPin(person: PinState, pin: string, now = new Date()): PinCheck {
  if (!person.pinHash) {
    return { ok: false, wrong: false, reason: `${person.name} has no PIN yet. Ask an admin to set one in Settings.` };
  }
  if (person.pinLockedUntil && person.pinLockedUntil > now) {
    const mins = Math.ceil((person.pinLockedUntil.getTime() - now.getTime()) / 60_000);
    return {
      ok: false,
      wrong: false,
      reason: `Too many wrong PINs. Try again in ${mins} minute${mins === 1 ? "" : "s"}.`,
    };
  }
  if (validPin(pin) && verifyPassword(pin, person.pinHash)) return { ok: true };
  return { ok: false, wrong: true, reason: "Wrong PIN." };
}

/** After a wrong PIN, counted: what to tell them, and whether that locks it. */
export function wrongPinMessage(name: string, failures: number): { reason: string; lock: boolean } {
  if (failures >= PIN_TRIES) {
    return { reason: `Wrong PIN. That was ${PIN_TRIES} in a row, so picking ${name} is locked for 15 minutes.`, lock: true };
  }
  const left = PIN_TRIES - failures;
  return { reason: `Wrong PIN. ${left} more ${left === 1 ? "try" : "tries"} before it locks.`, lock: false };
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set.");
  return s;
}

const sign = (body: string) => createHmac("sha256", secret()).update(body).digest("base64url");

/** A ticket saying this person was picked, with their PIN, on this login, just now. */
export function makePickTicket(personId: string, owner: string, now = Date.now()): string {
  const body = `${personId}.${owner.toLowerCase()}.${now + TICKET_MS}`;
  return `${body}.${sign(body)}`;
}

/** The person a ticket names, if it is genuine, unexpired and for this login. */
export function readPickTicket(ticket: unknown, owner: string, now = Date.now()): string | null {
  if (typeof ticket !== "string") return null;
  const at = ticket.lastIndexOf(".");
  if (at < 0) return null;
  const body = ticket.slice(0, at);
  const given = Buffer.from(ticket.slice(at + 1));
  const expected = Buffer.from(sign(body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;

  const [personId, ticketOwner, exp] = [body.slice(0, body.indexOf(".")), ...splitRest(body)];
  if (!personId || ticketOwner !== owner.toLowerCase() || !(Number(exp) > now)) return null;
  return personId;
}

/** "id.owner@x.com.au.123" → ["owner@x.com.au", "123"]: the email has dots of its own. */
function splitRest(body: string): [string, string] {
  const rest = body.slice(body.indexOf(".") + 1);
  const last = rest.lastIndexOf(".");
  return [rest.slice(0, last), rest.slice(last + 1)];
}
