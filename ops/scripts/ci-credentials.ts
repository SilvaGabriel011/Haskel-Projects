/**
 * Throwaway demo credentials for one CI run.
 *
 * The end-to-end suite signs in through the demo password provider, which needs
 * a hash per seeded account. Nothing is stored anywhere: each run makes fresh
 * random passwords, masks them in the log, and hands them to later steps via
 * GITHUB_ENV. They die with the runner.
 *
 *   npx tsx scripts/ci-credentials.ts
 */
import { appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { hashPassword } from "../lib/password";

const target = process.env.GITHUB_ENV;
if (!target) {
  console.error("GITHUB_ENV is not set. This script only runs inside GitHub Actions.");
  process.exit(1);
}

const lines: string[] = [];
// INFO is the shared login (info@): two people on it, picked by PIN.
for (const account of ["ADMIN", "INSTALLER", "APPRENTICE", "INFO"]) {
  const password = randomBytes(18).toString("base64url");
  console.log(`::add-mask::${password}`);
  lines.push(`DEMO_${account}_PASSWORD_HASH=${hashPassword(password)}`);
  lines.push(`E2E_${account}_PASSWORD=${password}`);
}

appendFileSync(target, lines.join("\n") + "\n");
console.log("Demo credentials generated for this run.");
