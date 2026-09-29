#!/usr/bin/env node
/**
 * Turn JUnit reports into the run's diagnostic summary.
 *
 *   node scripts/ci-summary.mjs "Unit tests" reports/unit-junit.xml
 *
 * Writes a table per suite and every failure with its message to
 * GITHUB_STEP_SUMMARY, so a red run says what broke on the run page itself
 * instead of making someone scroll the raw log. Outside Actions it prints the
 * same markdown to stdout.
 *
 * Deliberately a small regex reader, not an XML dependency: JUnit from node:test
 * and Playwright is flat and predictable, and this must never be the thing that
 * fails a build.
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";

const [title, ...files] = process.argv.slice(2);

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? "";
const unescape = (s) =>
  s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const oneLine = (s) => unescape(s).replace(/\s+/g, " ").trim().slice(0, 300);

const suites = new Map();
const failures = [];
let missing = [];

for (const file of files) {
  if (!existsSync(file)) {
    missing.push(file);
    continue;
  }
  const xml = readFileSync(file, "utf8");
  // Walk tags in order so a test is filed under its innermost <testsuite>:
  // node:test nests one per describe and leaves classname generic.
  const stack = [];
  for (const m of xml.matchAll(/<(\/?)(testsuite|testcase)\b([^>]*?)(\/?)>([\s\S]*?)(?=<\/?testsuite\b|<testcase\b|$)/g)) {
    const [, closing, tag, attrs, selfClosing, body] = m;
    if (tag === "testsuite") {
      if (closing) stack.pop();
      else if (!selfClosing) stack.push(unescape(attr(attrs, "name")));
      continue;
    }
    if (closing) continue;
    const suite = stack.filter(Boolean).at(-1) || attr(attrs, "classname") || "(no suite)";
    const name = unescape(attr(attrs, "name"));
    const s = suites.get(suite) ?? { pass: 0, fail: 0, skip: 0, time: 0 };
    s.time += Number(attr(attrs, "time")) || 0;

    const failure = selfClosing ? null : body.match(/<(failure|error)\b([^>]*)>?([\s\S]*?)(<\/\1>|$)/);
    if (failure) {
      s.fail++;
      let message = oneLine(attr(failure[2], "message") || failure[3]);
      // node:test reports a file that threw outside any test (a failed import,
      // a missing DATABASE_URL) as one generic "test failed". Say so.
      if (message === "test failed") message = "the file failed outside any test (import or setup); the reason is in the job log";
      failures.push({ suite, name, message });
    } else if (!selfClosing && /<skipped\b/.test(body)) {
      s.skip++;
    } else {
      s.pass++;
    }
    suites.set(suite, s);
  }
}

const totals = [...suites.values()].reduce(
  (t, s) => ({ pass: t.pass + s.pass, fail: t.fail + s.fail, skip: t.skip + s.skip }),
  { pass: 0, fail: 0, skip: 0 },
);

const out = [];
const status = missing.length && !suites.size ? "⚠️ no report" : totals.fail ? "❌" : "✅";
out.push(`## ${status} ${title}`);
out.push("");
out.push(`**${totals.pass} passed · ${totals.fail} failed · ${totals.skip} skipped**`);
out.push("");

if (suites.size) {
  out.push("| Suite | Passed | Failed | Skipped | Time |");
  out.push("|---|---:|---:|---:|---:|");
  for (const [name, s] of [...suites].sort((a, b) => b[1].fail - a[1].fail || a[0].localeCompare(b[0]))) {
    out.push(`| ${s.fail ? "❌ " : ""}${name} | ${s.pass} | ${s.fail} | ${s.skip} | ${s.time.toFixed(2)}s |`);
  }
  out.push("");
}

if (failures.length) {
  out.push("### Failures");
  out.push("");
  for (const f of failures) out.push(`- **${f.suite}** › ${f.name}\n  \`${f.message.replace(/`/g, "'")}\``);
  out.push("");
}

if (missing.length) {
  out.push(`> Report not found: ${missing.map((f) => `\`${f}\``).join(", ")}. The step that writes it probably failed before running any test; see the job log.`);
  out.push("");
}

const markdown = out.join("\n") + "\n";
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
else process.stdout.write(markdown);
