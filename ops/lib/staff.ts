/**
 * The staff list.
 *
 * Phase 1 keeps people in code so the system runs with no database to set up.
 * Phase 2 moves this to a `User` table; everything else reads through
 * `findStaffByEmail`, so that swap touches this file only.
 */
import type { Role } from "./roles";

export type Staff = {
  email: string;
  name: string;
  role: Role;
  /** Env var holding this person's demo password hash. Demo accounts only. */
  passwordEnv?: string;
};

const DOMAIN_PLACEHOLDER = "haskelprojects.com.au";

export const STAFF: readonly Staff[] = [
  {
    email: `admin@${DOMAIN_PLACEHOLDER}`,
    name: "Gabriel Silva",
    role: "ADMIN",
    passwordEnv: "DEMO_ADMIN_PASSWORD_HASH",
  },
  {
    email: `installer@${DOMAIN_PLACEHOLDER}`,
    name: "Dave Whitlock",
    role: "EMPLOYEE",
    passwordEnv: "DEMO_INSTALLER_PASSWORD_HASH",
  },
  {
    email: `apprentice@${DOMAIN_PLACEHOLDER}`,
    name: "Sam Reid",
    role: "EMPLOYEE",
    passwordEnv: "DEMO_APPRENTICE_PASSWORD_HASH",
  },
] as const;

export function findStaffByEmail(email: string | null | undefined): Staff | null {
  if (!email) return null;
  const needle = email.trim().toLowerCase();
  return STAFF.find((s) => s.email.toLowerCase() === needle) ?? null;
}

/** True when demo password sign-in is switched on. */
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
