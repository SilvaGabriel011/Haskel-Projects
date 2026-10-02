/**
 * What changed in Haskel Ops, release by release, newest first.
 *
 * One list feeds two places: the version and changelog in Settings, and the
 * one-time "What's new" card on the dashboard. Add a release at the top when
 * something ships that staff will notice, and bump `version` in package.json
 * to match — tests/releases.test.ts fails if the two drift apart.
 *
 * Written for the people using the app, not for developers: what they will
 * see, in their words. An item with `roles` is shown only to those roles in
 * What's new; Settings is admin only and shows everything.
 */
import type { Role } from "@prisma/client";

export type ReleaseItem = {
  text: string;
  /** Who it matters to. Omitted means everyone. */
  roles?: readonly Role[];
  /** Where to see it. */
  href?: string;
};

export type Release = {
  version: string;
  /** The day it went live, as YYYY-MM-DD. */
  date: string;
  title: string;
  items: readonly ReleaseItem[];
};

const ADMIN: readonly Role[] = ["ADMIN"];
const EMPLOYEE: readonly Role[] = ["EMPLOYEE"];

export const RELEASES: readonly Release[] = [
  {
    version: "1.5.0",
    date: "2026-10-02",
    title: "Every stone to pick from",
    items: [
      {
        text: "New job lists the stone the trade sells, not just what is on the rack: pick the type, then the brand or stone, then the colour. Thickness and finish then offer only what that colour is made in.",
        roles: ADMIN,
        href: "/orders/new",
      },
      {
        text: "Add stock offers the same colours. Picking one fills in its name, supplier, thickness and finish, so only the cost is left.",
        roles: ADMIN,
        href: "/stock",
      },
      {
        text: "Engineered stone lists only silica-free ranges, as the law has required since July 2024.",
        roles: ADMIN,
      },
    ],
  },
  {
    version: "1.4.1",
    date: "2026-10-02",
    title: "Fixes",
    items: [
      {
        text: "Accepting a website booking from a client already on file puts the job under their profile, however they typed their number.",
        roles: ADMIN,
        href: "/bookings",
      },
      {
        text: "Jobs from website bookings start on the timeline at Initial, and the follow-up board counts their days from when they were accepted.",
      },
      {
        text: "Add stock spots a colour already on file whatever the capitals, and “Cut from” only lists slabs of the same colour.",
        roles: ADMIN,
        href: "/stock",
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-10-01",
    title: "Open jobs by hand",
    items: [
      {
        text: "New job on Orders: pick the client or create their profile, as a person or a company, then the site, the job and the stone.",
        roles: ADMIN,
        href: "/orders/new",
      },
      {
        text: "When a company hires you for a homeowner, the company is the client and the homeowner is shown on the job under “At the site”.",
        roles: ADMIN,
      },
      {
        text: "Jobs for a company now show the homeowner and their phone under “At the site”, so you know who to ring about access.",
        roles: EMPLOYEE,
      },
      {
        text: "Add stock picks the stone from dropdowns: type, then colour, thickness and finish.",
        roles: ADMIN,
        href: "/stock",
      },
      {
        text: "A job with no quote yet says so, instead of showing the stone’s cost as a loss.",
        roles: ADMIN,
      },
      {
        text: "Getting started now has short clips of the app in use.",
        href: "/welcome",
      },
      {
        text: "Signing in from a link takes you back to that page, and the sign-in address is short and readable.",
      },
      { text: "This list, and the version you are on, in Settings.", roles: ADMIN, href: "/settings#version" },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-10-01",
    title: "Getting started",
    items: [
      {
        text: "New staff are shown round the app on their first sign-in. Anyone can open it again from “Getting started” in the menu.",
        href: "/welcome",
      },
    ],
  },
  {
    version: "1.2.1",
    date: "2026-09-30",
    title: "Fixes and speed",
    items: [
      { text: "Switching someone off in Settings takes effect on their next click, not hours later.", roles: ADMIN },
      { text: "The boards stack on a phone instead of scrolling sideways." },
      { text: "Pages load faster, and the fonts no longer wait on Google." },
      { text: "Dozens of smaller fixes to times, totals and wording." },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-09-30",
    title: "Stages, follow-up and runs",
    items: [
      { text: "Every job runs the same eleven stages, and each job shows how long it spent in each one." },
      { text: "Follow up flags jobs stuck in a stage, missing details, or past their booked date.", href: "/board" },
      { text: "The schedule shows which jobs are near each other, so a run can take them together.", href: "/schedule" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-09-29",
    title: "Adelaide time, and no double bookings",
    items: [
      { text: "Times, days and weeks follow Adelaide, wherever the server is." },
      { text: "A booking or a piece of stock can no longer be claimed twice by two clicks at once." },
      { text: "Sign-in tells a refused account apart from a fault on our side." },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-09-16",
    title: "Haskel Ops",
    items: [
      { text: "The back office: stock and offcuts, jobs, the schedule, financials and staff settings." },
      { text: "Booking requests from the website, accepted or declined by the office.", roles: ADMIN },
    ],
  },
];

export const CURRENT: Release = RELEASES[0];

/** A release's items for one role. */
export function itemsFor(release: Release, role: Role): ReleaseItem[] {
  return release.items.filter((i) => !i.roles || i.roles.includes(role));
}

/**
 * What to tell someone on the dashboard, or null for nothing.
 *
 * Only people already using the app: someone new is shown round by the
 * walkthrough instead. Everything since the version they last saw, newest
 * first; someone who has never seen one gets the latest release with
 * something for their role, not the whole history. A release with nothing
 * for their role is skipped.
 */
export function whatsNewFor(
  user: { onboardedAt: Date | null; seenVersion: string | null },
  role: Role,
): Array<{ release: Release; items: ReleaseItem[] }> | null {
  if (user.onboardedAt === null || user.seenVersion === CURRENT.version) return null;

  const seenAt = RELEASES.findIndex((r) => r.version === user.seenVersion);
  // Unknown or never seen: just the latest that has something for them, so
  // an office-only release does not leave the installers with nothing.
  const latestForRole = RELEASES.find((r) => itemsFor(r, role).length > 0);
  const unseen = seenAt === -1 ? (latestForRole ? [latestForRole] : []) : RELEASES.slice(0, seenAt);

  const shown = unseen
    .map((release) => ({ release, items: itemsFor(release, role) }))
    .filter((r) => r.items.length > 0);
  return shown.length ? shown : null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-10-01" as "1 Oct 2026". A calendar day, so no time zone to get wrong. */
export function releaseDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
