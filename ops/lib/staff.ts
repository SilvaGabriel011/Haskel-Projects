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

/** Look someone up by email. Inactive people are treated as absent. */
export async function findStaffByEmail(email: string | null | undefined): Promise<Staff | null> {
  if (!email) return null;
  const user = await db.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
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
  workspaceDomain,
} from "./access-config";
