/**
 * The vercel.app address forwards to the company domain in production, and
 * nothing else is ever redirected: not local, not CI, not the domain itself.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canonicalRedirect } from "../lib/canonical-host";

const PROD = { canonicalHost: "ops.haskelproject.com.au", vercelEnv: "production" };
const at = (u: string) => new URL(u);

describe("canonical host", () => {
  it("sends the vercel.app address to the company domain, keeping path and query", () => {
    const to = canonicalRedirect(at("https://haskel-ops.vercel.app/orders/abc?denied=/financials"), PROD);
    assert.equal(to?.toString(), "https://ops.haskelproject.com.au/orders/abc?denied=/financials");
  });

  it("leaves the company domain alone", () => {
    assert.equal(canonicalRedirect(at("https://ops.haskelproject.com.au/login"), PROD), null);
  });

  it("does nothing outside production or without the setting", () => {
    const url = at("https://haskel-ops.vercel.app/login");
    assert.equal(canonicalRedirect(url, { ...PROD, vercelEnv: "preview" }), null);
    assert.equal(canonicalRedirect(url, { ...PROD, vercelEnv: undefined }), null);
    assert.equal(canonicalRedirect(url, { ...PROD, canonicalHost: "" }), null);
  });

  it("never redirects local development", () => {
    assert.equal(canonicalRedirect(at("http://localhost:3000/login"), PROD), null);
  });
});
