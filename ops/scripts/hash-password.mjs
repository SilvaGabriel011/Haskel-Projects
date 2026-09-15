#!/usr/bin/env node
/**
 * Generate a password hash for a demo account.
 *
 *   npm run hash -- "some password"
 *   npm run hash                      (generates a strong one for you)
 *
 * Paste the output into .env.local. The plain password is printed once here
 * and never stored anywhere.
 */
import { randomBytes, scryptSync } from "node:crypto";

const WORDS = [
  "slab", "offcut", "rack", "mitre", "quartz", "granite", "polish", "bench",
  "vanity", "chisel", "marble", "edge", "shim", "caulk", "trestle", "hearth",
];

function generate() {
  const pick = () => WORDS[randomBytes(1)[0] % WORDS.length];
  const n = 10 + (randomBytes(1)[0] % 90);
  return `${pick()}-${pick()}-${n}`;
}

const password = process.argv[2] ?? generate();
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 64);

console.log(`\n  password : ${password}`);
console.log(`  hash     : scrypt:${salt.toString("hex")}:${hash.toString("hex")}\n`);
console.log("  Put the hash in .env.local. Give the password to the person. Do not commit either.\n");
