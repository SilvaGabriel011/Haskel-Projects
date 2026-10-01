/**
 * The address a signed-out visit is sent to, and where sign-in lands.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loginUrl, safeNext } from "../lib/login-url";

const at = (path: string) => loginUrl(new URL(path, "https://ops.haskelproject.com.au")).toString();

describe("the sign-in address", () => {
  it("is plain /login when they were going to the dashboard anyway", () => {
    assert.equal(at("/"), "https://ops.haskelproject.com.au/login");
    assert.equal(at("/dashboard"), "https://ops.haskelproject.com.au/login");
  });

  it("remembers a deeper link as a short path, never the full address", () => {
    const url = at("/orders/abc?tab=stock");
    assert.equal(new URL(url).searchParams.get("next"), "/orders/abc?tab=stock");
    assert.ok(!url.includes("callbackUrl"));
    assert.ok(!url.includes("https%3A"));
    assert.equal(url, "https://ops.haskelproject.com.au/login?next=/orders/abc?tab=stock");
  });

  it("keeps a query with several parts whole", () => {
    const url = new URL(at("/schedule?who=sam&week=2"));
    assert.equal(url.searchParams.get("next"), "/schedule?who=sam&week=2");
  });
});

describe("where sign-in lands", () => {
  it("on the remembered page", () => {
    assert.equal(safeNext("/orders/abc?tab=stock"), "/orders/abc?tab=stock");
  });

  it("on the dashboard when there is nothing to remember", () => {
    assert.equal(safeNext(undefined), "/dashboard");
    assert.equal(safeNext(""), "/dashboard");
  });

  it("never on another site, however the address is dressed up", () => {
    for (const evil of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "\\\\evil.com",
      "/\t/evil.com",
      "/\n/evil.com",
      "javascript:alert(1)",
      "/login?next=//evil.com",
    ]) {
      assert.equal(safeNext(evil), "/dashboard", JSON.stringify(evil));
    }
  });
});
