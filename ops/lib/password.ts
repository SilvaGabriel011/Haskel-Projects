/**
 * Password hashing for the demo accounts, using scrypt from the Node standard
 * library. No dependency, no native build step, and nothing to compile on
 * Vercel. Real sign-in is Google Workspace SSO; this path exists only so the
 * system can be explored before that is wired up, and disappears when
 * DEMO_MODE is off.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;
const PREFIX = "scrypt";
// Fields are joined with ":" and NOT "$": a "$" in a .env value is treated as a
// variable reference and silently expanded away, both locally and on Vercel.
const SEP = ":";

/** Produce a `scrypt:salt:hash` string for .env.local. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN);
  return [PREFIX, salt.toString("hex"), hash.toString("hex")].join(SEP);
}

/** Constant-time check of a password against a stored `scrypt:salt:hash`. */
export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(SEP);
  if (parts.length !== 3 || parts[0] !== PREFIX) return false;

  const [, saltHex, hashHex] = parts;
  let expected: Buffer;
  try {
    expected = Buffer.from(hashHex, "hex");
  } catch {
    return false;
  }
  if (expected.length !== KEYLEN) return false;

  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEYLEN);
  return timingSafeEqual(actual, expected);
}
