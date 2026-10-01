/**
 * Opening a job by hand: what the form accepts, and what it writes.
 *
 * The writing half runs against the real database. Everything it makes is
 * removed afterwards; job numbers are minted for a month years away so they
 * never meet the seed's.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { db } from "../lib/db";
import { createJob, nextJobNumber, validateNewJob } from "../lib/new-job";
import { coloursOf, describeStone, finishOptions, thicknessOptions } from "../lib/stone";

const FAR = new Date("2031-03-15T02:00:00Z");
const TAG = `newjob-${Date.now()}`;
const phone = (n: number) => `04${String(Date.now()).slice(-6)}${n}`.slice(0, 12);

const person = {
  clientMode: "new",
  clientKind: "PERSON",
  clientName: "Jo Smith",
  phone: "0412 345 678",
  source: "PHONE",
  jobType: "VANITY_TOP",
  address: "12 Example St",
  suburb: "Prospect",
};

describe("the New job form", () => {
  it("accepts a person with no stone chosen, on the board the job type implies", () => {
    const r = validateNewJob(person);
    assert.ok(r.ok);
    assert.equal(r.value.pipeline, "SHORT");
    assert.equal(r.value.stone, null);
    assert.deepEqual(r.value.client, {
      create: { kind: "PERSON", name: "Jo Smith", contactName: null, phone: "0412 345 678", email: null, source: "PHONE" },
    });
  });

  it("puts a benchtop install on the long board unless told otherwise", () => {
    const r = validateNewJob({ ...person, jobType: "FULL_BENCHTOP" });
    assert.ok(r.ok && r.value.pipeline === "FULL");
    const s = validateNewJob({ ...person, jobType: "FULL_BENCHTOP", pipeline: "SHORT" });
    assert.ok(s.ok && s.value.pipeline === "SHORT");
  });

  it("keeps a site contact only when the client is a company", () => {
    const company = validateNewJob({
      ...person,
      clientKind: "COMPANY",
      clientName: "Hills Kitchens",
      contactName: "Dana",
      siteContactName: "The homeowner",
      siteContactPhone: "0498 765 432",
    });
    assert.ok(company.ok);
    assert.equal(company.value.siteContactName, "The homeowner");
    assert.ok("create" in company.value.client && company.value.client.create.contactName === "Dana");

    const p = validateNewJob({ ...person, siteContactName: "Someone", contactName: "Dana" });
    assert.ok(p.ok);
    assert.equal(p.value.siteContactName, null);
    assert.ok("create" in p.value.client && p.value.client.create.contactName === null);
  });

  it("refuses what it cannot open a job with", () => {
    const cases: Array<[Record<string, unknown>, RegExp]> = [
      [{ ...person, clientKind: "" }, /person or a company/],
      [{ ...person, clientName: "" }, /name/],
      [{ ...person, phone: "123" }, /phone/],
      [{ ...person, email: "not-an-email" }, /email/],
      [{ ...person, source: "" }, /found us/],
      [{ ...person, jobType: "" }, /kind of job/],
      [{ ...person, address: "" }, /address/],
      [{ ...person, suburb: "" }, /suburb/],
      [{ clientMode: "existing", customerId: "" }, /Pick the client/],
      [{ ...person, materialId: "m1", thicknessMm: "", finish: "Polished" }, /thickness/],
      [{ ...person, materialId: "m1", thicknessMm: "20", finish: "" }, /finish/],
      [{ ...person, materialId: "m1", thicknessMm: "20", finish: "Polished", sqm: "lots" }, /square metres/],
      [{ ...person, clientKind: "COMPANY", siteContactPhone: "12" }, /site contact/],
    ];
    for (const [form, why] of cases) {
      const r = validateNewJob(form);
      assert.ok(!r.ok, JSON.stringify(form));
      assert.match(r.reason, why);
    }
  });
});

describe("the stone dropdowns", () => {
  it("offer the standard thicknesses plus any on file, in order", () => {
    assert.deepEqual(thicknessOptions([20, 25, 20]), [12, 20, 25, 30, 40]);
  });

  it("offer the standard finishes plus others on file, without repeats", () => {
    const f = finishOptions(["polished", "Flamed", " Flamed "]);
    assert.equal(f.filter((x) => x.toLowerCase() === "polished").length, 1);
    assert.equal(f.at(-1), "Flamed");
  });

  it("list only the colours of the chosen type", () => {
    const ms = [
      { id: "a", kind: "ENGINEERED" as const },
      { id: "b", kind: "NATURAL" as const },
    ];
    assert.deepEqual(coloursOf(ms, "NATURAL").map((m) => m.id), ["b"]);
    assert.deepEqual(coloursOf(ms, ""), []);
  });

  it("describe the choice on the job line", () => {
    assert.equal(describeStone({ name: "Calacatta Gold" }, 30, "Honed"), "Calacatta Gold · 30 mm · Honed");
  });
});

describe("job numbers", () => {
  it("follow on from the highest this month, ignoring other months and booking numbers", () => {
    assert.equal(nextJobNumber(FAR, []), "HP-3103-001");
    assert.equal(nextJobNumber(FAR, ["HP-3103-007", "HP-3103-B099", "HP-3102-050"]), "HP-3103-008");
  });
});

describe("opening the job", () => {
  let adminId: string;
  let material: { id: string; name: string };
  const orderIds: string[] = [];
  const customerIds: string[] = [];

  before(async () => {
    const admin = await db.user.findFirst({ where: { role: "ADMIN", active: true }, select: { id: true } });
    const m = await db.material.findFirst({ select: { id: true, name: true } });
    assert.ok(admin && m, "seed must contain an admin and a material");
    adminId = admin.id;
    material = m;
  });

  after(async () => {
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.customer.deleteMany({ where: { id: { in: customerIds } } });
    await db.$disconnect();
  });

  async function open(form: Record<string, unknown>) {
    const v = validateNewJob(form);
    assert.ok(v.ok, v.ok ? "" : v.reason);
    const r = await createJob(v.value, adminId, FAR);
    if (r.ok) {
      orderIds.push(r.orderId);
      const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { customerId: true } });
      if (!customerIds.includes(o.customerId)) customerIds.push(o.customerId);
    }
    return r;
  }

  it("creates a company's profile, the job under it, the homeowner on the job and the stone line", async () => {
    const r = await open({
      ...person,
      clientKind: "COMPANY",
      clientName: `${TAG} Kitchens`,
      contactName: "Dana",
      phone: phone(1),
      siteContactName: "Pat Homeowner",
      siteContactPhone: "0498 765 432",
      materialId: material.id,
      thicknessMm: "30",
      finish: "Honed",
      sqm: "2.4",
    });
    assert.ok(r.ok, r.ok ? "" : r.reason);

    const o = await db.order.findUniqueOrThrow({
      where: { id: r.orderId },
      include: { customer: true, stages: true, lines: true },
    });
    assert.match(o.jobNumber, /^HP-3103-\d{3}$/);
    assert.equal(o.status, "INITIAL");
    assert.equal(o.customer.kind, "COMPANY");
    assert.equal(o.customer.contactName, "Dana");
    assert.equal(o.siteContactName, "Pat Homeowner");
    assert.equal(o.stages.length, 1);
    assert.equal(o.stages[0].exitedAt, null, "the first stage is open");
    assert.equal(o.lines.length, 1);
    assert.equal(o.lines[0].description, `${material.name} · 30 mm · Honed`);
    assert.equal(o.lines[0].sqm, 2.4);
  });

  it("files a second job under an existing client, with its own number", async () => {
    const first = await open({ ...person, clientName: `${TAG} Person`, phone: phone(2) });
    assert.ok(first.ok);
    const c = await db.order.findUniqueOrThrow({ where: { id: first.orderId }, select: { customerId: true } });

    const second = await open({ clientMode: "existing", customerId: c.customerId, jobType: "REPAIR", address: "3 Other St", suburb: "Unley" });
    assert.ok(second.ok);
    const o = await db.order.findUniqueOrThrow({ where: { id: second.orderId }, select: { customerId: true } });
    assert.equal(o.customerId, c.customerId);
    assert.notEqual(first.jobNumber, second.jobNumber);
  });

  it("drops a site contact sent for a person's job, even if the form claims a company", async () => {
    const first = await open({ ...person, clientName: `${TAG} Solo`, phone: phone(3) });
    assert.ok(first.ok);
    const c = await db.order.findUniqueOrThrow({ where: { id: first.orderId }, select: { customerId: true } });
    const r = await open({
      clientMode: "existing", customerId: c.customerId, clientKind: "COMPANY",
      siteContactName: "Nobody", jobType: "REPAIR", address: "4 St", suburb: "Unley",
    });
    assert.ok(r.ok);
    const o = await db.order.findUniqueOrThrow({ where: { id: r.orderId }, select: { siteContactName: true } });
    assert.equal(o.siteContactName, null);
  });

  it("will not make a second profile for a phone number already on file", async () => {
    const p = phone(4);
    assert.ok((await open({ ...person, clientName: `${TAG} First`, phone: p })).ok);
    const dup = await open({ ...person, clientName: `${TAG} Again`, phone: p });
    assert.ok(!dup.ok);
    assert.match(dup.reason, /already has that phone number/);
  });
});
