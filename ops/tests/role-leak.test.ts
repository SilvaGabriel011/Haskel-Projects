/**
 * The test that actually matters.
 *
 * Asserts on the OBJECT THE SERVER RETURNS, not on rendered HTML — if a money
 * key is present here it would be serialised into the page payload and findable
 * in devtools, whatever the UI chooses to display.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "../lib/db";
import { getOrder, listOrders, revenueByMonth } from "../lib/queries/orders";

const MONEY_KEYS = ["quoteCents", "depositCents", "costCents", "costPerSqmCents", "unitPriceCents", "lineTotalCents", "margin"];

function moneyKeysIn(obj: unknown, path = ""): string[] {
  if (obj === null || typeof obj !== "object") return [];
  if (obj instanceof Date) return [];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => moneyKeysIn(v, `${path}[${i}]`));
  return Object.entries(obj).flatMap(([k, v]) => {
    const here = MONEY_KEYS.includes(k) ? [`${path}.${k}`] : [];
    return [...here, ...moneyKeysIn(v, `${path}.${k}`)];
  });
}

let orderId: string;

before(async () => {
  const o = await db.order.findFirst({ where: { status: "COMPLETE" }, select: { id: true } });
  assert.ok(o, "seed must contain a completed order — run npm run db:seed");
  orderId = o.id;
});

after(async () => { await db.$disconnect(); });

describe("an employee never receives money", () => {
  it("getOrder returns no money key anywhere in the payload", async () => {
    const order = await getOrder(orderId, "EMPLOYEE");
    assert.ok(order);
    const leaked = moneyKeysIn(order);
    assert.deepEqual(leaked, [], `leaked: ${leaked.join(", ")}`);
  });

  it("still gets what they need to do the job", async () => {
    const order = await getOrder(orderId, "EMPLOYEE");
    assert.ok(order!.address);
    assert.ok(order!.jobNumber);
    assert.ok(order!.customer.phone);
    assert.ok(order!.status);
  });

  it("listOrders leaks nothing across the whole board", async () => {
    const orders = await listOrders("EMPLOYEE");
    assert.ok(orders.length > 10, "expected a populated board");
    const leaked = moneyKeysIn(orders);
    assert.deepEqual(leaked, [], `leaked: ${leaked.slice(0, 5).join(", ")}`);
  });

  it("lostReason is withheld too — it is commercial information", async () => {
    const lost = await db.order.findFirst({ where: { status: "LOST" }, select: { id: true } });
    if (!lost) return;
    const order = await getOrder(lost.id, "EMPLOYEE");
    assert.ok(!("lostReason" in (order as object)));
  });
});

describe("an admin does receive it", () => {
  it("getOrder carries the money", async () => {
    const order = await getOrder(orderId, "ADMIN");
    assert.ok(order);
    assert.equal(typeof order.quoteCents, "number");
    assert.equal(typeof order.depositCents, "number");
  });

  it("revenueByMonth spans both pipelines", async () => {
    const rows = await revenueByMonth(new Date("2025-09-01"));
    assert.ok(rows.length > 5);
    const pipelines = new Set(rows.map((r) => r.pipeline));
    assert.ok(pipelines.has("SHORT"), "expected short-pipeline revenue");
    assert.ok(pipelines.has("FULL"), "expected full-pipeline revenue");
  });
});
