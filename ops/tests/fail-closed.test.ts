/**
 * The access model rests on two environment variables. Both used to fail OPEN —
 * absent meant "skip the check" rather than "refuse". These lock in the
 * opposite, because a deploy that forgets one should not quietly let people in.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

const ORIGINAL = { ...process.env };

/** NODE_ENV is typed readonly, but these cases exist to exercise production. */
function setEnv(key: string, value: string | undefined) {
  const env = process.env as Record<string, string | undefined>;
  if (value === undefined) delete env[key];
  else env[key] = value;
}
afterEach(() => {
  process.env = { ...ORIGINAL };
});

async function freshStaff() {
  // Bust the module cache so each case reads the env it just set.
  const mod = await import(`../lib/access-config.ts?cachebust=${Math.random()}`);
  return mod as typeof import("../lib/access-config");
}

describe("the domain lock", () => {
  it("refuses Google sign-in in production when it is not configured", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("GOOGLE_WORKSPACE_DOMAIN", undefined);
    const { googleSignInBlockedReason } = await freshStaff();
    const reason = googleSignInBlockedReason();
    assert.ok(reason, "production with no domain must be blocked");
    assert.match(reason, /GOOGLE_WORKSPACE_DOMAIN/);
  });

  it("allows it in production once configured", async () => {
    setEnv("NODE_ENV", "production");
    setEnv("GOOGLE_WORKSPACE_DOMAIN", "haskelprojects.com.au");
    const { googleSignInBlockedReason } = await freshStaff();
    assert.equal(googleSignInBlockedReason(), null);
  });

  it("does not obstruct local development", async () => {
    setEnv("NODE_ENV", "development");
    setEnv("GOOGLE_WORKSPACE_DOMAIN", undefined);
    const { googleSignInBlockedReason } = await freshStaff();
    assert.equal(googleSignInBlockedReason(), null);
  });

  it("treats whitespace as unset rather than as a domain", async () => {
    setEnv("GOOGLE_WORKSPACE_DOMAIN", "   ");
    const { workspaceDomain } = await freshStaff();
    assert.equal(workspaceDomain(), null);
  });
});

describe("demo mode", () => {
  it("is off unless switched on explicitly", async () => {
    for (const v of [undefined, "", "false", "1", "yes", "TRUE"]) {
      process.env = { ...ORIGINAL };
      setEnv("DEMO_MODE", v);
      const { demoModeEnabled } = await freshStaff();
      assert.equal(demoModeEnabled(), false, `DEMO_MODE=${JSON.stringify(v)} must not enable it`);
    }
  });

  it("is on for exactly the string 'true'", async () => {
    setEnv("DEMO_MODE", "true");
    const { demoModeEnabled } = await freshStaff();
    assert.equal(demoModeEnabled(), true);
  });
});

describe("the file people copy", () => {
  it("does not ship demo sign-in switched on", async () => {
    const { readFileSync } = await import("node:fs");
    const example = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    assert.match(example, /^DEMO_MODE=false$/m,
      ".env.example must not default DEMO_MODE to true");
  });
});
