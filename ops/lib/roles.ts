/**
 * Roles and what each may reach.
 *
 * This module is the single source of truth for access. It is imported by the
 * middleware, by every server route guard and by the sidebar, so the three can
 * never drift apart and quietly open a hole.
 */

export const ROLES = ["ADMIN", "EMPLOYEE"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** A section of the app, and who is allowed into it. */
export type Section = {
  href: string;
  label: string;
  blurb: string;
  allow: readonly Role[];
};

/**
 * Order here is the order in the sidebar. `allow` is load-bearing: it drives
 * the middleware guard, the per-page assertion and which links render.
 */
export const SECTIONS: readonly Section[] = [
  { href: "/dashboard", label: "Dashboard", blurb: "What is on today", allow: ["ADMIN", "EMPLOYEE"] },
  { href: "/stock", label: "Stock", blurb: "Slabs, offcuts and consumables", allow: ["ADMIN", "EMPLOYEE"] },
  { href: "/offcuts", label: "Offcuts", blurb: "What is on the rack", allow: ["ADMIN", "EMPLOYEE"] },
  { href: "/orders", label: "Orders", blurb: "Jobs from enquiry to complete", allow: ["ADMIN", "EMPLOYEE"] },
  { href: "/schedule", label: "Schedule", blurb: "Installs, templates and repairs", allow: ["ADMIN", "EMPLOYEE"] },
  { href: "/financials", label: "Financials", blurb: "Revenue, margin and stock value", allow: ["ADMIN"] },
  { href: "/settings", label: "Settings", blurb: "People and access", allow: ["ADMIN"] },
] as const;

/** Sections this role may see in the sidebar. */
export function sectionsFor(role: Role): Section[] {
  return SECTIONS.filter((s) => s.allow.includes(role));
}

/**
 * May this role open this path?
 *
 * Unknown paths are allowed through so that adding a page does not silently
 * 404 behind the guard; every page still asserts its own role server-side.
 */
export function canAccess(role: Role, pathname: string): boolean {
  const section = SECTIONS.find(
    (s) => pathname === s.href || pathname.startsWith(`${s.href}/`),
  );
  return section ? section.allow.includes(role) : true;
}

/** Where a role lands after signing in. */
export const HOME_FOR: Record<Role, string> = {
  ADMIN: "/dashboard",
  EMPLOYEE: "/dashboard",
};
