/**
 * Opening a job by hand, from the office.
 *
 * Until now a job could only come from accepting a website booking. This is
 * the phone call, the repeat builder, the walk-in.
 *
 * Who the client is. The client is whoever orders and pays. A kitchen company
 * or builder hiring us for one of their own customers is the client in its own
 * right: the job goes under the company, and the homeowner is recorded on the
 * job as the site contact, the person to ring about access. One company
 * profile then collects every job it sends us, which is how they are dealt
 * with in practice.
 *
 * Validation is pure so it is unit tested; createJob does the writing.
 */
import { Prisma, type CustomerKind, type CustomerSource, type JobType, type Pipeline } from "@prisma/client";

import { zonedParts } from "@/lib/business-time";
import { db } from "@/lib/db";
import { CUSTOMER_SOURCES, JOB_TYPES, defaultPipeline } from "@/lib/job-options";
import { describeStone } from "@/lib/stone";

const MAX = { name: 80, phone: 30, email: 120, address: 160, suburb: 60, notes: 1000, finish: 40 };

export type NewClient = {
  kind: CustomerKind;
  name: string;
  contactName: string | null;
  phone: string;
  email: string | null;
  source: CustomerSource;
};

export type NewJobInput = {
  client: { existingId: string } | { create: NewClient };
  siteContactName: string | null;
  siteContactPhone: string | null;
  jobType: JobType;
  pipeline: Pipeline;
  address: string;
  suburb: string;
  notes: string | null;
  stone: { materialId: string; thicknessMm: number; finish: string; sqm: number } | null;
};

export type Validated = { ok: true; value: NewJobInput } | { ok: false; reason: string };

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function phoneOf(v: unknown): string | null {
  const phone = str(v);
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15 || phone.length > MAX.phone) return null;
  return phone;
}

export function validateNewJob(f: Record<string, unknown>): Validated {
  // ---- the client
  let client: NewJobInput["client"];
  let kind: CustomerKind;
  if (str(f.clientMode) === "existing") {
    const existingId = str(f.customerId);
    if (!existingId) return { ok: false, reason: "Pick the client, or add a new one." };
    client = { existingId };
    // The company/person split for an existing client is checked against the
    // database in createJob; here it only decides whether a site contact applies.
    kind = str(f.clientKind) === "COMPANY" ? "COMPANY" : "PERSON";
  } else {
    const picked = (["PERSON", "COMPANY"] as const).find((k) => k === str(f.clientKind));
    if (!picked) return { ok: false, reason: "Say whether the client is a person or a company." };
    kind = picked;

    const name = str(f.clientName);
    if (name.length < 2 || name.length > MAX.name) {
      return { ok: false, reason: kind === "COMPANY" ? "Give the company's name." : "Give the client's name." };
    }

    const contactName = str(f.contactName);
    if (contactName.length > MAX.name) return { ok: false, reason: "That contact name is too long." };

    const phone = phoneOf(f.phone);
    if (!phone) return { ok: false, reason: "That phone number does not look right." };

    const email = str(f.email);
    if (email && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > MAX.email)) {
      return { ok: false, reason: "That email address does not look right." };
    }

    const source = CUSTOMER_SOURCES.find((s) => s === str(f.source));
    if (!source) return { ok: false, reason: "Say how they found us." };

    client = {
      create: {
        kind,
        name,
        contactName: kind === "COMPANY" ? contactName || null : null,
        phone,
        email: email || null,
        source,
      },
    };
  }

  // ---- who is at the site, when the client is a company
  let siteContactName: string | null = null;
  let siteContactPhone: string | null = null;
  if (kind === "COMPANY") {
    siteContactName = str(f.siteContactName) || null;
    if (siteContactName && siteContactName.length > MAX.name) {
      return { ok: false, reason: "That site contact's name is too long." };
    }
    const rawPhone = str(f.siteContactPhone);
    if (rawPhone) {
      siteContactPhone = phoneOf(rawPhone);
      if (!siteContactPhone) return { ok: false, reason: "The site contact's phone number does not look right." };
    }
  }

  // ---- the job
  const jobType = JOB_TYPES.find((t) => t === str(f.jobType));
  if (!jobType) return { ok: false, reason: "Pick the kind of job." };

  const pipeline: Pipeline =
    str(f.pipeline) === "FULL" ? "FULL" : str(f.pipeline) === "SHORT" ? "SHORT" : defaultPipeline(jobType);

  const address = str(f.address);
  if (address.length < 3 || address.length > MAX.address) return { ok: false, reason: "Give the site address." };

  const suburb = str(f.suburb);
  if (suburb.length < 2 || suburb.length > MAX.suburb) return { ok: false, reason: "Give the suburb." };

  const notes = str(f.notes);
  if (notes.length > MAX.notes) return { ok: false, reason: "Those notes are too long." };

  // ---- the stone, optional: often not chosen until the quote
  let stone: NewJobInput["stone"] = null;
  const materialId = str(f.materialId);
  if (materialId) {
    const thicknessMm = Number(str(f.thicknessMm));
    if (!Number.isInteger(thicknessMm) || thicknessMm < 3 || thicknessMm > 100) {
      return { ok: false, reason: "Pick the thickness." };
    }
    const finish = str(f.finish);
    if (!finish || finish.length > MAX.finish) return { ok: false, reason: "Pick the finish." };

    const rawSqm = str(f.sqm);
    const sqm = rawSqm ? Number(rawSqm) : 0;
    if (!Number.isFinite(sqm) || sqm < 0 || sqm > 200) {
      return { ok: false, reason: "Area should be square metres, such as 2.4." };
    }
    stone = { materialId, thicknessMm, finish, sqm: Math.round(sqm * 100) / 100 };
  }

  return {
    ok: true,
    value: {
      client,
      siteContactName,
      siteContactPhone,
      jobType,
      pipeline,
      address,
      suburb,
      notes: notes || null,
      stone,
    },
  };
}

/** HP-2610-042: the year and month, then the next number among this month's hand-opened jobs. */
export function nextJobNumber(now: Date, existing: readonly string[]): string {
  const { year, month } = zonedParts(now);
  const prefix = `HP-${String(year).slice(2)}${String(month).padStart(2, "0")}-`;
  let highest = 0;
  for (const j of existing) {
    if (!j.startsWith(prefix)) continue;
    const n = Number(j.slice(prefix.length));
    if (Number.isInteger(n) && n > highest) highest = n;
  }
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}

export type CreateResult = { ok: true; orderId: string; jobNumber: string } | { ok: false; reason: string };

class Refused extends Error {}

const isJobNumberClash = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError &&
  e.code === "P2002" &&
  JSON.stringify(e.meta ?? {}).includes("jobNumber");

export async function createJob(input: NewJobInput, userId: string, now = new Date()): Promise<CreateResult> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { year, month } = zonedParts(now);
    const prefix = `HP-${String(year).slice(2)}${String(month).padStart(2, "0")}-`;
    const used = await db.order.findMany({ where: { jobNumber: { startsWith: prefix } }, select: { jobNumber: true } });
    const jobNumber = nextJobNumber(now, used.map((o) => o.jobNumber));

    try {
      const order = await db.$transaction(async (tx) => {
        let customerId: string;
        let isCompany: boolean;

        if ("existingId" in input.client) {
          const found = await tx.customer.findUnique({
            where: { id: input.client.existingId },
            select: { id: true, kind: true },
          });
          if (!found) throw new Refused("That client is no longer on file.");
          customerId = found.id;
          isCompany = found.kind === "COMPANY";
        } else {
          const c = input.client.create;
          // One profile per phone number, so a client's jobs stay together
          // instead of splitting across duplicates.
          const same = await tx.customer.findFirst({ where: { phone: c.phone }, select: { name: true } });
          if (same) throw new Refused(`${same.name} already has that phone number. Pick them from the client list.`);
          const made = await tx.customer.create({ data: { ...c, suburb: input.suburb } });
          customerId = made.id;
          isCompany = c.kind === "COMPANY";
        }

        const order = await tx.order.create({
          data: {
            jobNumber,
            customerId,
            pipeline: input.pipeline,
            jobType: input.jobType,
            status: "INITIAL",
            address: input.address,
            suburb: input.suburb,
            notes: input.notes,
            // Only a company's job has someone else on site.
            siteContactName: isCompany ? input.siteContactName : null,
            siteContactPhone: isCompany ? input.siteContactPhone : null,
          },
        });

        // Open the first stage, so the job's timeline and the follow-up board
        // count its days from now like any other job.
        await tx.orderStage.create({
          data: { orderId: order.id, stage: "INITIAL", enteredAt: now, movedById: userId },
        });

        if (input.stone) {
          const material = await tx.material.findUnique({
            where: { id: input.stone.materialId },
            select: { name: true },
          });
          if (!material) throw new Refused("That stone is no longer on file.");
          await tx.orderLine.create({
            data: {
              orderId: order.id,
              description: describeStone(material, input.stone.thicknessMm, input.stone.finish),
              materialId: input.stone.materialId,
              sqm: input.stone.sqm,
            },
          });
        }

        return order;
      });
      return { ok: true, orderId: order.id, jobNumber: order.jobNumber };
    } catch (e) {
      if (e instanceof Refused) return { ok: false, reason: e.message };
      if (isJobNumberClash(e)) continue;
      throw e;
    }
  }
  return { ok: false, reason: "Could not allocate a job number. Try again." };
}
