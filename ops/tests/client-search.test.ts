/**
 * Finding a client on New job by typing.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { clientHint, newClientFrom, searchClients } from "../lib/client-search";

const clients = [
  { id: "1", kind: "COMPANY" as const, name: "Hills Kitchens", contactName: "Dana", phone: "08 8370 1200", suburb: "Stirling" },
  { id: "2", kind: "COMPANY" as const, name: "Seaview Builders", contactName: "Sam", phone: "(08) 8295 4411", suburb: "Glenelg" },
  { id: "3", kind: "PERSON" as const, name: "Jo Hill", contactName: null, phone: "0412 345 678", suburb: "Prospect" },
  { id: "4", kind: "PERSON" as const, name: "Renée Kitchener", contactName: null, phone: "0400 111 222", suburb: "Unley" },
];
const ids = (q: string) => searchClients(clients, q).map((c) => c.id);

describe("searching clients", () => {
  it("finds by name, a name starting with what was typed first", () => {
    assert.deepEqual(ids("hill"), ["1", "3"]);
    assert.deepEqual(ids("kitch"), ["1", "4"]);
  });

  it("finds by contact and suburb, and by every word typed", () => {
    assert.deepEqual(ids("dana"), ["1"]);
    assert.deepEqual(ids("glenelg"), ["2"]);
    assert.deepEqual(ids("hill prospect"), ["3"]);
  });

  it("finds by any run of three or more phone digits, however the number was written", () => {
    assert.deepEqual(ids("8295"), ["2"]);
    assert.deepEqual(ids("0412345"), ["3"]);
    assert.deepEqual(ids("08"), [], "two digits match too much to mean anything");
  });

  it("ignores accents and case, and returns nothing for nothing typed", () => {
    assert.deepEqual(ids("RENEE"), ["4"]);
    assert.deepEqual(ids("  "), []);
  });
});

describe("a client not on file", () => {
  it("is offered with the typed name, or the typed number as their phone", () => {
    assert.deepEqual(newClientFrom("  Jo   Smith "), { clientName: "Jo Smith" });
    assert.deepEqual(newClientFrom("0412 999 000"), { phone: "0412 999 000" });
    assert.equal(newClientFrom("0412"), null, "too short to be a phone number");
    assert.equal(newClientFrom("J"), null);
  });

  it("reads under the name with what tells two apart", () => {
    assert.equal(clientHint(clients[0]), "Company · Dana · 08 8370 1200 · Stirling");
    assert.equal(clientHint(clients[2]), "0412 345 678 · Prospect");
  });
});
