/**
 * Access configuration read from the environment.
 *
 * Deliberately separate from lib/staff.ts: that module touches the database and
 * is marked server-only, which makes it unimportable from a test. These are
 * pure environment reads, and they decide who can sign in — which is exactly
 * the code that most needs to be testable.
 */

/** True only for the exact string "true". Anything else, including absent, is off. */
export function demoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "true";
}

/**
 * The Workspace domain sign-in is pinned to. When set, a Google account from
 * any other domain is refused even if it is on the staff list.
 */
export function workspaceDomain(): string | null {
  const d = process.env.GOOGLE_WORKSPACE_DOMAIN?.trim();
  return d ? d.toLowerCase() : null;
}

/**
 * Whether Google sign-in may proceed at all.
 *
 * This used to fail OPEN: with GOOGLE_WORKSPACE_DOMAIN unset the domain check
 * was simply skipped, so a deploy that forgot to set it silently accepted any
 * Google account matching a staff email. The whole access model rests on that
 * one variable, so in production its absence is a refusal rather than a shrug.
 * Local development still runs without it.
 */
export function googleSignInBlockedReason(): string | null {
  if (workspaceDomain()) return null;
  if (process.env.NODE_ENV === "production") {
    return "GOOGLE_WORKSPACE_DOMAIN is not set, so sign-in cannot be limited to your company. Set it before anyone signs in.";
  }
  return null;
}

/**
 * Is this email on this domain?
 *
 * Compares the domain part exactly rather than asking whether the address ends
 * with the domain. `endsWith` happens to reject the lookalike
 * `x@evilhaskelproject.com.au` only because the "@" is part of the needle —
 * that is luck holding it up, not intent. A subdomain is also not the domain.
 */
export function emailOnDomain(email: string, domain: string): boolean {
  const at = email.lastIndexOf("@");
  if (at <= 0 || at === email.length - 1) return false;
  if (email.indexOf("@") !== at) return false; // a second "@" is not an address
  return email.slice(at + 1).toLowerCase() === domain.trim().toLowerCase();
}

/**
 * Which env var holds a given account's demo password hash. Demo mode only —
 * derived from the local part of the email so the mapping needs no table.
 */
export function demoPasswordEnvFor(email: string): string | null {
  const local = email.split("@")[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return local ? `DEMO_${local}_PASSWORD_HASH` : null;
}

/** The staff fields a session carries. */
export type StaffRecord = { id: string; email: string; name: string; role: "ADMIN" | "EMPLOYEE"; active: boolean };

/**
 * Re-read a signed-in person on every request, not only at sign-in.
 *
 * The role used to be stamped onto the token once, when they signed in, and
 * trusted until the token expired — up to 30 days. Deactivating someone or
 * taking admin away changed the User row and nothing else: they carried on
 * with the access they had. Now the row is the answer every time. Absent or
 * inactive means no session at all, and the role and name are whatever the
 * row says now.
 *
 * `lookup` is passed in so this stays free of the database and testable.
 */
export async function revalidateToken<
  T extends { sub?: string | null; role?: unknown; name?: string | null; email?: string | null; owner?: string | null },
>(token: T, lookup: (id: string) => Promise<StaffRecord | null>): Promise<T | null> {
  if (!token.sub) return null;
  const staff = await lookup(token.sub);
  if (!staff || !staff.active) return null;
  // The person must still belong to the login they were picked under: moving
  // someone to another email ends the session they had on the old one.
  const owner = token.owner ?? token.email;
  if (owner && staff.email.toLowerCase() !== owner.toLowerCase()) return null;
  return { ...token, role: staff.role, name: staff.name, email: staff.email, owner: staff.email.toLowerCase() };
}
