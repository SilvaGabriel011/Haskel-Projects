import type { Metadata } from "next";
import Link from "next/link";

import { MaterialBars } from "@/components/charts/material-bars";
import { RevenueBars } from "@/components/charts/revenue-bars";
import { PageHead } from "@/components/page-head";
import { Card, Empty, Pill, SectionTitle, Tile } from "@/components/ui";
import { requireAdmin } from "@/lib/guard";
import { formatAud } from "@/lib/money";
import {
  marginByJob, offcutComparison, revenueByMaterial, revenueSeries, summary,
} from "@/lib/queries/financials";

export const metadata: Metadata = { title: "Financials" };

export default async function FinancialsPage() {
  await requireAdmin();

  const [series, totals, materials, worst, split] = await Promise.all([
    revenueSeries(), summary(), revenueByMaterial(), marginByJob(), offcutComparison(),
  ]);

  return (
    <>
      <PageHead
        eyebrow="Last twelve months"
        title={<>how the year is <span className="it">tracking</span></>}
        lede="Completed work only, across both pipelines. Quotes and jobs still in progress are not counted as revenue."
      />

      <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Revenue" value={formatAud(totals.revenue)} sub={`${totals.jobs} jobs completed`} />
        <Tile label="Gross margin" value={formatAud(totals.margin)} sub={`${totals.marginPct}% of revenue, before overheads`} />
        <Tile label="Average job" value={formatAud(totals.avgJobCents)} sub={`${totals.winRate}% of quotes won`} />
        <Tile label="Stock on the rack" value={formatAud(totals.stockValue)} sub="At cost, in stock and reserved" href="/stock" />
      </section>

      <section className="mt-10">
        <SectionTitle aside={<span className="text-xs text-ink-2">Completed jobs, by month completed</span>}>
          Revenue
        </SectionTitle>
        <Card className="p-6">
          <RevenueBars data={series} />
        </Card>
      </section>

      <section className="mt-10">
        <SectionTitle>Offcut work against everything else</SectionTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-rose bg-blush p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Offcut projects</h3>
              <Pill tone="good">{split.offcut.jobs} jobs</Pill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-2">Revenue</div>
                <div className="mt-1 text-xl font-extrabold tabular-nums">{formatAud(split.offcut.revenue)}</div>
              </div>
              <div>
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-2">Margin</div>
                <div className="mt-1 text-xl font-extrabold tabular-nums">{split.offcut.marginPct}%</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-2">
              Average {formatAud(split.offcut.avgCents)} a job. Smaller jobs, but the stone was
              already paid for by the job that cut the slab.
            </p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold">Everything else</h3>
              <Pill>{split.other.jobs} jobs</Pill>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-2">Revenue</div>
                <div className="mt-1 text-xl font-extrabold tabular-nums">{formatAud(split.other.revenue)}</div>
              </div>
              <div>
                <div className="text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-ink-2">Margin</div>
                <div className="mt-1 text-xl font-extrabold tabular-nums">{split.other.marginPct}%</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-ink-2">
              Average {formatAud(split.other.avgCents)} a job. Bigger tickets, but the slab is
              costed against them.
            </p>
          </Card>
        </div>
        <p className="mt-3 max-w-3xl text-xs text-muted">
          <b>How this is worked out:</b> a job cutting a fresh slab is charged for the stone it
          uses. A job using an offcut is charged nothing for stone, because the slab was already
          costed to the job that cut it. Charging twice would understate offcut work. That is an
          assumption about how you account for it, not a fact — say the word and it changes.
          Either way these are <b>gross</b> margins: stone and labour on the tools only. Rent,
          vehicles, insurance and your own admin time are not in here, so this is not profit.
        </p>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>Revenue by material</SectionTitle>
          <Card className="p-6">
            {materials.length === 0 ? <Empty>Nothing completed yet.</Empty> : <MaterialBars data={materials} />}
          </Card>
        </section>

        <section>
          <SectionTitle aside={<span className="text-xs text-ink-2">Thinnest first</span>}>
            Jobs worth a look
          </SectionTitle>
          <Card className="divide-y divide-line">
            {worst.map((j) => (
              <Link key={j.id} href={`/orders/${j.id}`} className="block px-5 py-3 transition hover:bg-blush-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{j.customer}</div>
                    <div className="text-xs text-ink-2">
                      {j.jobNumber} · {j.hours}h
                      {j.usedOffcut ? " · offcut" : ""}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold tabular-nums ${j.marginCents < 0 ? "text-rose" : ""}`}>
                      {j.marginPct}%
                    </div>
                    <div className="text-xs tabular-nums text-ink-2">{formatAud(j.marginCents)}</div>
                  </div>
                  {j.marginCents < 0 ? <Pill tone="warn">loss</Pill> : null}
                </div>
              </Link>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
