/**
 * Financial queries. ADMIN ONLY — every caller must be behind requireAdmin().
 *
 * These read across BOTH pipelines from one table, which is the thing the
 * single-Order-table design bought back after choosing two boards.
 *
 * How material cost is modelled, stated openly because it drives every margin
 * on the page:
 *
 *   - A job cutting a fresh slab is charged sqm x the material's cost per sqm.
 *   - A job using an OFFCUT is charged nothing for material, because the slab
 *     it came from was already costed to the job that cut it. Charging twice
 *     would understate exactly the work this business is built on.
 *
 * That is why offcut work shows the margin it does. It is an assumption, not a
 * fact, and the page says so.
 */
import { db } from "@/lib/db";
import { LABOUR_RATE_CENTS, marginCents } from "@/lib/money";

const MONTHS = 12;

export function monthsBack(n = MONTHS): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

type CompletedJob = {
  id: string;
  jobNumber: string;
  completedAt: Date | null;
  pipeline: "SHORT" | "FULL";
  jobType: string;
  quoteCents: number;
  actualHours: number;
  estimatedHours: number;
  customer: { name: string };
  lines: Array<{
    sqm: number;
    offcutId: string | null;
    material: { name: string; costPerSqmCents: number } | null;
  }>;
};

async function completedSince(from: Date): Promise<CompletedJob[]> {
  return db.order.findMany({
    where: { status: "COMPLETE", completedAt: { gte: from } },
    select: {
      id: true, jobNumber: true, completedAt: true, pipeline: true, jobType: true,
      quoteCents: true, actualHours: true, estimatedHours: true,
      customer: { select: { name: true } },
      lines: {
        select: {
          sqm: true, offcutId: true,
          material: { select: { name: true, costPerSqmCents: true } },
        },
      },
    },
    orderBy: { completedAt: "asc" },
  }) as Promise<CompletedJob[]>;
}

/** Material cost for one job, under the model documented at the top of this file. */
export function jobMaterialCostCents(job: Pick<CompletedJob, "lines">): number {
  return job.lines.reduce((total, l) => {
    if (l.offcutId) return total; // already paid for by the job that cut the slab
    if (!l.material) return total;
    return total + Math.round(l.sqm * l.material.costPerSqmCents);
  }, 0);
}

export function jobMarginCents(job: CompletedJob): number {
  return marginCents({
    quoteCents: job.quoteCents,
    materialCostCents: jobMaterialCostCents(job),
    labourHours: job.actualHours || job.estimatedHours,
    labourRateCents: LABOUR_RATE_CENTS,
  });
}

/** Revenue per month, split by pipeline. Twelve buckets, oldest first. */
export async function revenueSeries(from = monthsBack()) {
  const jobs = await completedSince(from);

  const buckets = new Map<string, { month: string; short: number; full: number; jobs: number }>();
  for (let i = 0; i <= MONTHS; i++) {
    const d = new Date(from);
    d.setMonth(d.getMonth() + i, 1);
    buckets.set(monthKey(d), {
      month: d.toLocaleDateString("en-AU", { month: "short" }),
      short: 0,
      full: 0,
      jobs: 0,
    });
  }

  for (const j of jobs) {
    if (!j.completedAt) continue;
    const b = buckets.get(monthKey(j.completedAt));
    if (!b) continue;
    if (j.pipeline === "SHORT") b.short += j.quoteCents;
    else b.full += j.quoteCents;
    b.jobs += 1;
  }

  return [...buckets.values()];
}

/** The headline figures. */
export async function summary(from = monthsBack()) {
  const [jobs, quoted, lost, stock] = await Promise.all([
    completedSince(from),
    db.order.count({ where: { createdAt: { gte: from }, status: { not: "ENQUIRY" } } }),
    db.order.count({ where: { createdAt: { gte: from }, status: "LOST" } }),
    db.slab.aggregate({
      where: { status: { in: ["IN_STOCK", "RESERVED"] } },
      _sum: { costCents: true },
    }),
  ]);

  const revenue = jobs.reduce((t, j) => t + j.quoteCents, 0);
  const margin = jobs.reduce((t, j) => t + jobMarginCents(j), 0);
  const offcutRevenue = jobs
    .filter((j) => j.jobType === "OFFCUT_PROJECT")
    .reduce((t, j) => t + j.quoteCents, 0);

  return {
    revenue,
    margin,
    marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
    jobs: jobs.length,
    avgJobCents: jobs.length ? Math.round(revenue / jobs.length) : 0,
    winRate: quoted > 0 ? Math.round(((quoted - lost) / quoted) * 1000) / 10 : 0,
    offcutRevenue,
    offcutShare: revenue > 0 ? Math.round((offcutRevenue / revenue) * 1000) / 10 : 0,
    stockValue: stock._sum.costCents ?? 0,
  };
}

/** Revenue by material, biggest first. */
export async function revenueByMaterial(from = monthsBack(), take = 8) {
  const jobs = await completedSince(from);
  const totals = new Map<string, number>();

  for (const j of jobs) {
    // A job's revenue is attributed to its first line's material.
    const name = j.lines[0]?.material?.name;
    if (!name) continue;
    totals.set(name, (totals.get(name) ?? 0) + j.quoteCents);
  }

  return [...totals.entries()]
    .map(([name, cents]) => ({ name, cents }))
    .sort((a, b) => b.cents - a.cents)
    .slice(0, take);
}

/** Per-job margin, worst first — the ones worth looking at. */
export async function marginByJob(from = monthsBack(), take = 10) {
  const jobs = await completedSince(from);
  return jobs
    .map((j) => {
      const margin = jobMarginCents(j);
      return {
        id: j.id,
        jobNumber: j.jobNumber,
        customer: j.customer.name,
        jobType: j.jobType,
        pipeline: j.pipeline,
        usedOffcut: j.lines.some((l) => l.offcutId),
        quoteCents: j.quoteCents,
        materialCents: jobMaterialCostCents(j),
        hours: j.actualHours || j.estimatedHours,
        marginCents: margin,
        marginPct: j.quoteCents > 0 ? Math.round((margin / j.quoteCents) * 1000) / 10 : 0,
      };
    })
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, take);
}

/** Offcut work against everything else — the business's own pitch, measured. */
export async function offcutComparison(from = monthsBack()) {
  const jobs = await completedSince(from);
  const group = (want: boolean) => {
    const rows = jobs.filter((j) => (j.jobType === "OFFCUT_PROJECT") === want);
    const revenue = rows.reduce((t, j) => t + j.quoteCents, 0);
    const margin = rows.reduce((t, j) => t + jobMarginCents(j), 0);
    return {
      jobs: rows.length,
      revenue,
      margin,
      marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0,
      avgCents: rows.length ? Math.round(revenue / rows.length) : 0,
    };
  };
  return { offcut: group(true), other: group(false) };
}
