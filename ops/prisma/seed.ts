/**
 * Demo data — invented, but shaped like the real business.
 *
 * DETERMINISTIC: a fixed-seed PRNG, so `npm run db:reset` reproduces byte-identical
 * data. Screenshots stay stable and "it looked different yesterday" never happens.
 *
 * Weighted to reflect what Haskel actually does: offcut and small jobs dominate,
 * benchtop installs are the minority.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type CustomerSource,
  type EventKind,
  type JobType,
  type MaterialKind,
  type OrderStatus,
  type Pipeline,
} from "@prisma/client";

import { hashPassword } from "../lib/password";

// ---- deterministic randomness (mulberry32) -------------------------------
let _s = 0x9e3779b9;
function rnd(): number {
  _s |= 0;
  _s = (_s + 0x6d2b79f5) | 0;
  let t = Math.imul(_s ^ (_s >>> 15), 1 | _s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min: number, max: number) => min + Math.floor(rnd() * (max - min + 1));
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
const chance = (p: number) => rnd() < p;

const SUBURBS = [
  "Prospect", "Norwood", "Glenelg", "Unley", "Henley Beach", "Burnside",
  "Modbury", "Mawson Lakes", "Brighton", "Magill", "Woodville", "Aldinga",
  "Semaphore", "Mitcham", "Golden Grove", "Port Adelaide",
] as const;

const FIRST = ["Sarah","Tom","Priya","Dave","Emma","Luca","Chloe","Ben","Anh","Marco",
  "Jess","Kyle","Nadia","Owen","Ruby","Sam","Tara","Vik","Wendy","Zac"] as const;
const LAST = ["Nguyen","Patel","Hughes","Costa","Barnes","Willis","Tran","Rossi",
  "Doyle","Kaur","Mercer","Okafor","Pritchard","Silva","Vaughan","Whitlock"] as const;

const MATERIALS: ReadonlyArray<{
  name: string; kind: MaterialKind; supplier: string; finish: string; cents: number;
}> = [
  { name: "Calacatta Gold",   kind: "ENGINEERED", supplier: "Adelaide Stone Co", finish: "Polished",  cents: 48000 },
  { name: "White Truffle",    kind: "ENGINEERED", supplier: "Adelaide Stone Co", finish: "Matte",     cents: 42000 },
  { name: "Carrara Mist",     kind: "ENGINEERED", supplier: "Adelaide Stone Co", finish: "Polished",  cents: 39000 },
  { name: "Concreto Grigio",  kind: "ENGINEERED", supplier: "SA Surfaces",       finish: "Low sheen", cents: 36000 },
  { name: "Nero Assoluto",    kind: "NATURAL",    supplier: "Torrens Granite",   finish: "Satin",     cents: 61000 },
  { name: "Storm Grey",       kind: "ENGINEERED", supplier: "SA Surfaces",       finish: "Matte",     cents: 34000 },
  { name: "Alpine White",     kind: "ENGINEERED", supplier: "Adelaide Stone Co", finish: "Polished",  cents: 31000 },
  { name: "Sintered Graphite",kind: "SINTERED",   supplier: "Novastone",         finish: "Matte",     cents: 72000 },
  { name: "Sintered Bianco",  kind: "SINTERED",   supplier: "Novastone",         finish: "Polished",  cents: 69000 },
  { name: "Tuscan Travertine",kind: "NATURAL",    supplier: "Torrens Granite",   finish: "Honed",     cents: 55000 },
  { name: "Ash Quartz",       kind: "ENGINEERED", supplier: "SA Surfaces",       finish: "Matte",     cents: 33000 },
  { name: "Onyx Shadow",      kind: "NATURAL",    supplier: "Torrens Granite",   finish: "Polished",  cents: 78000 },
];

const CONSUMABLES = [
  { name: "Stone adhesive (clear)", unit: "tube",  qty: 34, reorder: 12, cents: 1850 },
  { name: "Stone adhesive (white)", unit: "tube",  qty: 8,  reorder: 12, cents: 1850 },
  { name: "Diamond blade 125mm",    unit: "blade", qty: 6,  reorder: 4,  cents: 8900 },
  { name: "Diamond blade 300mm",    unit: "blade", qty: 2,  reorder: 3,  cents: 24500 },
  { name: "Impregnating sealer",    unit: "litre", qty: 11, reorder: 5,  cents: 6400 },
  { name: "Polishing pads (set)",   unit: "set",   qty: 4,  reorder: 4,  cents: 12900 },
  { name: "Silicone (colour match)",unit: "tube",  qty: 27, reorder: 10, cents: 1450 },
  { name: "Mitre bond kit",         unit: "kit",   qty: 3,  reorder: 2,  cents: 15900 },
];

// SHORT-pipeline job types dominate: this is a small-jobs and offcuts business.
const SHORT_JOBS: readonly JobType[] = [
  "OFFCUT_PROJECT", "OFFCUT_PROJECT", "OFFCUT_PROJECT",
  "VANITY_TOP", "VANITY_TOP", "SMALL_BENCHTOP", "REPAIR", "CUTOUT",
  "TOP_REMOVAL", "SPLASHBACK",
];
const FULL_JOBS: readonly JobType[] = ["FULL_BENCHTOP", "FULL_BENCHTOP", "SMALL_BENCHTOP"];

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });

/** Must match LABOUR_RATE_CENTS in lib/money.ts, or margins will not reconcile. */
const LABOUR_RATE = 9500;

const MONTHS_BACK = 12;
const NOW = new Date("2026-09-15T00:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

async function main() {
  console.log("clearing...");
  await db.scheduleAssignee.deleteMany();
  await db.scheduleEvent.deleteMany();
  await db.stockMovement.deleteMany();
  await db.orderLine.deleteMany();
  await db.order.deleteMany();
  await db.customer.deleteMany();
  await db.offcut.deleteMany();
  await db.slab.deleteMany();
  await db.consumable.deleteMany();
  await db.material.deleteMany();
  await db.user.deleteMany();

  // ---- people -----------------------------------------------------------
  const staff = await Promise.all([
    db.user.create({ data: { email: "admin@haskelprojects.com.au",      name: "Gabriel Silva", role: "ADMIN" } }),
    db.user.create({ data: { email: "installer@haskelprojects.com.au",  name: "Dave Whitlock", role: "EMPLOYEE" } }),
    db.user.create({ data: { email: "apprentice@haskelprojects.com.au", name: "Sam Reid",      role: "EMPLOYEE" } }),
  ]);
  const [admin] = staff;
  const crew = staff.slice(1);

  // ---- materials & consumables -----------------------------------------
  const materials = [];
  for (const m of MATERIALS) {
    materials.push(await db.material.create({
      data: { name: m.name, kind: m.kind, supplier: m.supplier, finish: m.finish,
              thicknessMm: 20, costPerSqmCents: m.cents },
    }));
  }
  for (const c of CONSUMABLES) {
    await db.consumable.create({
      data: { name: c.name, unit: c.unit, qtyOnHand: c.qty, reorderPoint: c.reorder, unitCostCents: c.cents },
    });
  }

  // ---- slabs -------------------------------------------------------------
  const slabs = [];
  for (let i = 1; i <= 40; i++) {
    const m = pick(materials);
    const widthMm = pick([1400, 1500, 1600] as const);
    const lengthMm = pick([3000, 3200, 3600] as const);
    const sqm = (widthMm / 1000) * (lengthMm / 1000);
    const arrived = daysAgo(int(5, MONTHS_BACK * 30));
    const r = rnd();
    const status = r < 0.42 ? "IN_STOCK" : r < 0.55 ? "RESERVED" : r < 0.9 ? "CUT" : "SOLD";
    slabs.push(await db.slab.create({
      data: {
        ref: `SLB-${String(i).padStart(4, "0")}`,
        materialId: m.id, widthMm, lengthMm, status,
        rack: `${pick(["A", "B", "C"] as const)}${int(1, 8)}`,
        costCents: Math.round(sqm * m.costPerSqmCents),
        arrivedAt: arrived,
      },
    }));
    await db.stockMovement.create({
      data: { kind: "RECEIVED", slabId: slabs[i - 1].id, userId: admin.id,
              note: `Delivered by ${m.supplier}`, createdAt: arrived },
    });
  }

  // ---- offcuts: the specialty, so there are plenty ----------------------
  const cutSlabs = slabs.filter((s) => s.status === "CUT" || s.status === "SOLD");
  const offcuts = [];
  for (let i = 1; i <= 25; i++) {
    const parent = cutSlabs.length ? pick(cutSlabs) : pick(slabs);
    const r = rnd();
    const status = r < 0.6 ? "AVAILABLE" : r < 0.82 ? "RESERVED" : "SOLD";
    const created = daysAgo(int(2, 300));
    offcuts.push(await db.offcut.create({
      data: {
        ref: `OFF-${String(i).padStart(4, "0")}`,
        parentSlabId: parent.id, materialId: parent.materialId,
        widthMm: int(300, 900), lengthMm: int(600, 2100), thicknessMm: 20,
        finish: pick(["Polished", "Matte", "Satin", "Honed"] as const),
        status, rack: `OFF-${pick(["A", "B"] as const)}${int(1, 5)}`,
        listedPublicly: status === "AVAILABLE" && chance(0.75),
        createdAt: created,
      },
    }));
    await db.stockMovement.create({
      data: { kind: "RECEIVED", offcutId: offcuts[i - 1].id, userId: admin.id,
              note: `Offcut from ${parent.ref}`, createdAt: created },
    });
  }

  // ---- customers ---------------------------------------------------------
  const customers = [];
  for (let i = 0; i < 45; i++) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const suburb = pick(SUBURBS);
    const source: CustomerSource = pick([
      "WEBSITE", "WEBSITE", "OFFCUTS_PAGE", "OFFCUTS_PAGE",
      "PHONE", "REFERRAL", "REPEAT", "WALK_IN",
    ] as const);
    customers.push(await db.customer.create({
      data: {
        name, suburb, source,
        phone: `04${int(10, 99)} ${int(100, 999)} ${int(100, 999)}`,
        email: chance(0.7) ? `${name.split(" ")[0].toLowerCase()}${int(1, 99)}@example.com` : null,
        createdAt: daysAgo(int(1, MONTHS_BACK * 30)),
      },
    }));
  }

  // ---- orders ------------------------------------------------------------
  const availableOffcuts = offcuts.filter((o) => o.status !== "AVAILABLE");
  let jobNo = 0;
  const orders = [];

  for (let i = 0; i < 70; i++) {
    // 3 in 4 jobs are short-pipeline work.
    const pipeline: Pipeline = chance(0.75) ? "SHORT" : "FULL";
    const jobType = pipeline === "SHORT" ? pick(SHORT_JOBS) : pick(FULL_JOBS);
    const customer = pick(customers);
    const createdAt = daysAgo(int(1, MONTHS_BACK * 30));

    // Older jobs are more likely to be finished.
    const ageDays = Math.round((NOW.getTime() - createdAt.getTime()) / 86_400_000);
    const r = rnd();
    let status: OrderStatus;
    if (ageDays > 60) status = r < 0.82 ? "COMPLETE" : "LOST";
    else if (ageDays > 21) status = r < 0.55 ? "COMPLETE" : r < 0.72 ? "LOST" : pick(pipeline === "SHORT" ? (["WON", "CUTTING"] as const) : (["TEMPLATED", "FABRICATING", "SCHEDULED"] as const));
    else status = r < 0.3 ? "ENQUIRY" : r < 0.55 ? "QUOTED" : r < 0.75 ? "WON" : pick(pipeline === "SHORT" ? (["CUTTING", "COMPLETE"] as const) : (["TEMPLATED", "SCHEDULED", "INSTALLED"] as const));

    const isOffcutJob = jobType === "OFFCUT_PROJECT";
    const sqm = isOffcutJob ? Number((0.3 + rnd() * 1.1).toFixed(2))
              : pipeline === "SHORT" ? Number((0.6 + rnd() * 2.2).toFixed(2))
              : Number((3.5 + rnd() * 6).toFixed(2));
    const hours = Number((isOffcutJob ? 2 + rnd() * 3 : pipeline === "SHORT" ? 3 + rnd() * 5 : 9 + rnd() * 12).toFixed(1));

    // Pick the stone BEFORE pricing: a quote is a markup on the material that
    // is actually going into the job, not an independent number. Getting this
    // backwards priced jobs below the cost of their own stone.
    const usedOffcut = isOffcutJob && availableOffcuts.length ? pick(availableOffcuts) : null;
    const material = usedOffcut ? materials.find((m) => m.id === usedOffcut.materialId)! : pick(materials);
    const usedSlab = usedOffcut
      ? null
      : (() => {
          const ofMaterial = slabs.filter((sl) => sl.materialId === material.id);
          return ofMaterial.length ? pick(ofMaterial) : pick(slabs);
        })();

    // Offcut work is sold at a fraction of fresh-slab rate — that is the pitch —
    // and carries no material cost, because the slab was paid for by the job
    // that cut it. Slab work is marked up on what the stone actually cost.
    const rate = Math.round(
      material.costPerSqmCents * (isOffcutJob ? 0.55 + rnd() * 0.25 : 1.9 + rnd() * 0.8),
    );
    const quoteCents = Math.round(sqm * rate + hours * LABOUR_RATE + int(4000, 18000));
    const won = ["WON","CUTTING","TEMPLATED","FABRICATING","SCHEDULED","INSTALLED","COMPLETE"].includes(status);
    const done = status === "COMPLETE";

    jobNo++;
    const order = await db.order.create({
      data: {
        jobNumber: `HP-26${String(int(1, 9)).padStart(2, "0")}-${String(jobNo).padStart(3, "0")}`,
        customerId: customer.id, pipeline, jobType, status,
        address: `${int(1, 180)} ${pick(["Beach","Park","Church","King","Grange","Henley","Marion"] as const)} Rd`,
        suburb: customer.suburb,
        quoteCents,
        depositCents: won ? Math.round(quoteCents * 0.3) : 0,
        estimatedHours: hours,
        actualHours: done ? Number((hours * (0.85 + rnd() * 0.4)).toFixed(1)) : 0,
        createdAt,
        wonAt: won ? new Date(createdAt.getTime() + int(1, 9) * 86_400_000) : null,
        completedAt: done ? new Date(createdAt.getTime() + int(10, 40) * 86_400_000) : null,
        lostReason: status === "LOST" ? pick(["Went with a cheaper quote","Renovation postponed","No reply after quote","Wanted a full slab"] as const) : null,
      },
    });
    orders.push(order);

    // One line, referencing the stock chosen above, so the movement log and the
    // margin both point at the same physical piece.
    await db.orderLine.create({
      data: {
        orderId: order.id,
        description: usedOffcut ? `${material.name} offcut ${usedOffcut.ref}, cut to size` : `${material.name}, cut and polished`,
        materialId: material.id,
        offcutId: usedOffcut?.id ?? null,
        slabId: usedSlab?.id ?? null,
        sqm, labourHours: hours,
        unitPriceCents: rate,
        lineTotalCents: quoteCents,
      },
    });

    if (won) {
      await db.stockMovement.create({
        data: {
          kind: done ? "CONSUMED" : "RESERVED",
          offcutId: usedOffcut?.id ?? null,
          slabId: usedSlab?.id ?? null,
          userId: pick(staff).id, orderId: order.id,
          note: `${order.jobNumber} — ${jobType.toLowerCase().replace(/_/g, " ")}`,
          createdAt: order.wonAt!,
        },
      });
    }
  }

  // ---- schedule ----------------------------------------------------------
  const schedulable = orders.filter((o) =>
    ["WON","CUTTING","TEMPLATED","FABRICATING","SCHEDULED","INSTALLED","COMPLETE"].includes(o.status));
  let events = 0;
  for (const o of schedulable.slice(0, 60)) {
    const kinds: EventKind[] = o.pipeline === "FULL" ? ["TEMPLATE", "INSTALL"] : ["INSTALL"];
    for (const kind of kinds) {
      const base = o.wonAt ?? o.createdAt;
      const start = new Date(base.getTime() + int(2, 25) * 86_400_000);
      start.setUTCHours(int(7, 13), chance(0.5) ? 0 : 30, 0, 0);
      const ev = await db.scheduleEvent.create({
        data: {
          orderId: o.id, kind, startAt: start,
          endAt: new Date(start.getTime() + int(1, 5) * 3_600_000),
          address: `${o.address}, ${o.suburb}`,
        },
      });
      await db.scheduleAssignee.create({ data: { eventId: ev.id, userId: pick(crew).id } });
      if (chance(0.3)) {
        const second = crew.find((c) => c.id !== pick(crew).id);
        if (second) {
          await db.scheduleAssignee.createMany({
            data: [{ eventId: ev.id, userId: second.id }], skipDuplicates: true });
        }
      }
      events++;
    }
  }

  // ---- report ------------------------------------------------------------
  const counts = {
    users: await db.user.count(),
    materials: await db.material.count(),
    slabs: await db.slab.count(),
    offcuts: await db.offcut.count(),
    offcutsListed: await db.offcut.count({ where: { listedPublicly: true } }),
    consumables: await db.consumable.count(),
    lowStock: await db.consumable.count({ where: { qtyOnHand: { lte: db.consumable.fields.reorderPoint } } }),
    customers: await db.customer.count(),
    orders: await db.order.count(),
    ordersShort: await db.order.count({ where: { pipeline: "SHORT" } }),
    ordersFull: await db.order.count({ where: { pipeline: "FULL" } }),
    complete: await db.order.count({ where: { status: "COMPLETE" } }),
    lines: await db.orderLine.count(),
    movements: await db.stockMovement.count(),
    events,
  };
  console.table(counts);

  // Demo passwords, only when asked for — hashes go to .env.local by hand.
  if (process.env.SEED_PRINT_PASSWORDS === "true") {
    for (const u of staff) {
      const pw = `${u.name.split(" ")[0].toLowerCase()}-demo-${int(10, 99)}`;
      console.log(`${u.email}  ${pw}  ${hashPassword(pw)}`);
    }
  }
}

main()
  .then(() => db.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await db.$disconnect();
    process.exit(1);
  });
