/**
 * The staff list — now backed by the User table.
 *
 * IMPORTANT: everything here touches Prisma, so none of it can run on the edge
 * runtime. The middleware (proxy.ts) must not import this file. It doesn't need
 * to: the role is stamped onto the JWT during sign-in, which runs on the Node
 * runtime, and the middleware only reads the token.
 */
import "server-only";

import type { Role } from "@prisma/client";

import { db } from "@/lib/db";

export type Staff = {
  id: string;
  email: string;
  name: string;
  role: Role;
  active: boolean;
};

/**
 * The people who sign in with this email, active ones only, by name.
 *
 * Usually one. A shared login (info@…) has one per person, and they pick
 * themselves with a PIN after signing in (lib/pin.ts).
 */
export async function findPeopleByLogin(email: string | null | undefined): Promise<Staff[]> {
  if (!email) return [];
  return db.user.findMany({
    where: { email: email.trim().toLowerCase(), active: true },
    select: { id: true, email: true, name: true, role: true, active: true },
    orderBy: { name: "asc" },
  });
}

/** Look someone up by id, active or not — the caller decides what inactive means. */
export async function findStaffById(id: string): Promise<Staff | null> {
  return db.user.findUnique({
    where: { id },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
}

export async function listStaff(): Promise<Staff[]> {
  return db.user.findMany({
    where: { active: true },
    select: { id: true, email: true, name: true, role: true, active: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });
}

// Access configuration lives in lib/access-config.ts so it stays testable —
// this module is server-only because it touches the database.
export {
  demoModeEnabled,
  demoPasswordEnvFor,
  emailOnDomain,
  googleSignInBlockedReason,
  revalidateToken,
  workspaceDomain,
} from "./access-config";
