#!/usr/bin/env node
/**
 * Checks the static public site before it deploys.
 *
 * Every local href/src in haskel-site/*.html must point at a file that exists,
 * or at a path the root vercel.json rewrites (today /book and /api/book, which
 * are served by the ops app). A broken link here ships silently otherwise:
 * the site has no build step to catch it.
 *
 * Exits 1 on any problem and writes the list to the run summary.
 */
import { appendFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const SITE = "haskel-site";
const rewrites = new Set(
  (JSON.parse(readFileSync("vercel.json", "utf8")).rewrites ?? []).map((r) => r.source),
);

const problems = [];
let checked = 0;

for (const page of readdirSync(SITE).filter((f) => f.endsWith(".html"))) {
  const html = readFileSync(join(SITE, page), "utf8");
  for (const [, ref] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|#|data:)/.test(ref)) continue;
    const path = ref.split(/[?#]/)[0];
    if (!path) continue;
    checked++;

    if (path.startsWith("/")) {
      if (rewrites.has(path)) continue;
      const file = join(SITE, path);
      if (!existsSync(file) && !existsSync(`${file}.html`)) problems.push(`${page}: ${ref} (no file, no rewrite)`);
    } else if (!existsSync(join(SITE, path))) {
      problems.push(`${page}: ${ref} (missing file)`);
    }
  }
}

const lines = [
  `## ${problems.length ? "❌" : "✅"} Public site links`,
  "",
  `${checked} local links and assets checked, ${problems.length} broken.`,
  "",
  ...problems.map((p) => `- ${p}`),
  "",
];
const markdown = lines.join("\n");
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
process.exit(problems.length ? 1 : 0);
