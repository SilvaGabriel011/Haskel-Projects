import type { Metadata } from "next";
import Link from "next/link";

import { PageHead } from "@/components/page-head";
import { Empty, Pill, when } from "@/components/ui";
import { requireAccess } from "@/lib/guard";
import { formatAud } from "@/lib/money";
import { JOB_TYPE_LABEL } from "@/lib/job-options";
import { PIPELINE_LABEL, STAGES, STATUS_LABEL } from "@/lib/pipeline";
import { ordersBoard, pipelineCounts } from "@/lib/queries/orders";
import type { OrderStatus, Pipeline } from "@prisma/client";

export const metadata: Metadata = { title: "Orders" };

const JOB_LABEL = JOB_TYPE_LABEL;

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ pipeline?: string }>;
}) {
  const user = await requireAccess("/orders");
  const isAdmin = user.role === "ADMIN";
  const { pipeline: raw } = await searchParams;
  const pipeline: Pipeline = raw === "FULL" ? "FULL" : "SHORT";

  const [orders, counts] = await Promise.all([ordersBoard(user.role, pipeline), pipelineCounts()]);

  const stages = STAGES;
  // A board is for work in progress. Twelve months of finished jobs would
  // otherwise bury the columns you actually act on, so each column shows the
  // most recent few and says how many more there are.
  const PER_COLUMN = 8;
  const byStage = new Map<OrderStatus, typeof orders>();
  for (const s of stages) byStage.set(s, []);
  for (const o of orders) byStage.get(o.status)?.push(o);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-6">
        <PageHead
          eyebrow="Two boards, one table"
          title={<>orders</>}
          lede="Offcut and small jobs run a short board. Benchtop installs run the long one. The figures read across both."
        />
        {isAdmin ? (
          <div className="pt-2">
            <Link
              href="/orders/new"
              className="inline-block rounded-full bg-rose px-5 py-2.5 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep"
            >
              New job
            </Link>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        {(["SHORT", "FULL"] as const).map((p) => {
          const active = pipeline === p;
          return (
            <Link
              key={p}
              href={`/orders?pipeline=${p}`}
              aria-current={active ? "page" : undefined}
              className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                active
                  ? "border-rose bg-rose text-white"
                  : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
              }`}
            >
              {PIPELINE_LABEL[p]}
              <span className={`ml-2 tabular-nums ${active ? "text-white/70" : "text-muted"}`}>
                {p === "SHORT" ? counts.short : counts.full}
              </span>
            </Link>
          );
        })}
        <span className="self-center text-xs text-ink-2">{counts.lost} lost, not shown</span>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8"><Empty>Nothing on this board.</Empty></div>
      ) : (
        <div className="mt-8 pb-4 sm:overflow-x-auto">
          {/* On a phone the stages stack, each only as tall as its own cards.
              Side by side they scrolled sideways inside a row as tall as the
              tallest column, so one card sat above a long empty gap. Empty
              stages are left out there; from sm up it is the full board. */}
          <div
            className="flex flex-col gap-6 sm:min-w-(--board-min) sm:flex-row sm:gap-4"
            style={{ "--board-min": `${stages.length * 260}px` } as React.CSSProperties}
          >
            {stages.map((stage) => {
              const all = byStage.get(stage) ?? [];
              const items = all.slice(0, PER_COLUMN);
              const hidden = all.length - items.length;
              return (
                <section key={stage} className={`sm:min-w-[244px] sm:flex-1 ${all.length ? "" : "hidden sm:block"}`}>
                  <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em]">
                      {STATUS_LABEL[stage]}
                    </h2>
                    <span className="text-xs tabular-nums text-muted">{all.length}</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    {all.length === 0 ? (
                      <div className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
                        Nothing here
                      </div>
                    ) : (
                      items.map((o) => (
                        <Link
                          key={o.id}
                          href={`/orders/${o.id}`}
                          className="rounded-[14px] border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-rose hover:shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs font-semibold tabular-nums text-rose">{o.jobNumber}</span>
                            {o.jobType === "OFFCUT_PROJECT" ? <Pill tone="good">offcut</Pill> : null}
                          </div>
                          <div className="mt-2 text-sm font-semibold">{o.customer.name}</div>
                          <div className="mt-0.5 text-xs text-ink-2">
                            {JOB_LABEL[o.jobType] ?? o.jobType} · {o.suburb}
                          </div>
                          <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-2 text-xs text-ink-2">
                            <span>{when(o.createdAt)}</span>
                            {isAdmin && "quoteCents" in o ? (
                              <span className="font-semibold tabular-nums text-ink">
                                {formatAud(o.quoteCents)}
                              </span>
                            ) : (
                              <span className="tabular-nums">{o.estimatedHours}h</span>
                            )}
                          </div>
                        </Link>
                      ))
                    )}
                    {hidden > 0 ? (
                      <div className="rounded-[14px] border border-dashed border-line px-4 py-3 text-center text-xs text-muted">
                        {hidden} older {hidden === 1 ? "job" : "jobs"} not shown
                      </div>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
