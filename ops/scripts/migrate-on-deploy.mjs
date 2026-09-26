/**
 * Runs before `next build` on Vercel (package.json "vercel-build").
 *
 * Applies pending migrations on PRODUCTION deploys only. Preview deploys share
 * the same environment variables by default, so letting a branch preview
 * migrate would change the live database from an unreviewed branch.
 *
 * Migrations need a real session, which Supabase's transaction pooler (6543)
 * does not give, and the direct host is IPv6 only, which Vercel's build
 * machines cannot reach. DIRECT_URL is therefore the SESSION pooler (5432).
 */
import { spawnSync } from "node:child_process";

const env = process.env.VERCEL_ENV;

if (env && env !== "production") {
  console.log(`[migrate] ${env} deploy, skipping migrations.`);
  process.exit(0);
}

if (!process.env.DIRECT_URL) {
  console.error("[migrate] DIRECT_URL is not set. Refusing to build production without migrating.");
  process.exit(1);
}

const run = spawnSync("npx", ["prisma", "migrate", "deploy"], { stdio: "inherit" });
process.exit(run.status ?? 1);
