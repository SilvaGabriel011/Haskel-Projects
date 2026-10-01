/**
 * The changelog behind Settings and the dashboard's What's new.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { CURRENT, RELEASES, itemsFor, releaseDate, whatsNewFor } from "../lib/releases";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };
const semver = (v: string) => v.split(".").map(Number);
const newer = (a: string, b: string) => {
  const [x, y] = [semver(a), semver(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

describe("the release list", () => {
  it("is the version the app says it is", () => {
    assert.equal(pkg.version, CURRENT.version, "bump package.json when you add a release, or the other way round");
  });

  it("runs newest first, one entry per version, with real dates that never go forwards", () => {
    for (let i = 1; i < RELEASES.length; i++) {
      assert.ok(newer(RELEASES[i - 1].version, RELEASES[i].version), `${RELEASES[i - 1].version} before ${RELEASES[i].version}`);
      assert.ok(RELEASES[i - 1].date >= RELEASES[i].date, `${RELEASES[i - 1].version} dated before ${RELEASES[i].version}`);
    }
    for (const r of RELEASES) {
      assert.match(r.version, /^\d+\.\d+\.\d+$/);
      assert.match(r.date, /^\d{4}-\d{2}-\d{2}$/);
      assert.ok(!Number.isNaN(Date.parse(r.date)), r.date);
      assert.ok(r.items.length > 0, `${r.version} says nothing`);
    }
  });

  it("reads a date as a calendar day", () => {
    assert.equal(releaseDate("2026-10-01"), "1 Oct 2026");
    assert.equal(releaseDate("2026-12-31"), "31 Dec 2026");
  });

  it("tells an employee only what applies to them", () => {
    const forEmployee = itemsFor(CURRENT, "EMPLOYEE");
    assert.ok(forEmployee.length > 0);
    assert.ok(forEmployee.every((i) => !i.roles || i.roles.includes("EMPLOYEE")));
    assert.ok(itemsFor(CURRENT, "ADMIN").length > forEmployee.length);
  });
});

describe("What's new on the dashboard", () => {
  const onboarded = new Date("2026-09-01");

  it("shows nothing to someone new: the walkthrough covers it", () => {
    assert.equal(whatsNewFor({ onboardedAt: null, seenVersion: null }, "ADMIN"), null);
  });

  it("shows nothing once they have seen the current version", () => {
    assert.equal(whatsNewFor({ onboardedAt: onboarded, seenVersion: CURRENT.version }, "ADMIN"), null);
  });

  it("shows only the latest release to someone who has never seen one, not the whole history", () => {
    const news = whatsNewFor({ onboardedAt: onboarded, seenVersion: null }, "ADMIN");
    assert.deepEqual(news?.map((n) => n.release.version), [CURRENT.version]);
  });

  it("shows everything since the version they last saw, newest first", () => {
    const last = RELEASES[2].version;
    const news = whatsNewFor({ onboardedAt: onboarded, seenVersion: last }, "ADMIN");
    assert.deepEqual(news?.map((n) => n.release.version), [RELEASES[0].version, RELEASES[1].version]);
  });

  it("skips a release with nothing for their role", () => {
    const adminOnly = RELEASES.findIndex((r) => itemsFor(r, "EMPLOYEE").length === 0);
    if (adminOnly === -1) return; // every release has something for everyone
    const news = whatsNewFor({ onboardedAt: onboarded, seenVersion: RELEASES.at(-1)!.version }, "EMPLOYEE") ?? [];
    assert.ok(!news.some((n) => n.release.version === RELEASES[adminOnly].version));
  });
});
