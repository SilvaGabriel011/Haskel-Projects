import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdvanceButton } from "@/components/advance-button";
import { Card, Empty, Pill, SectionTitle, dims, when } from "@/components/ui";
import { requireAccess } from "@/lib/guard";
import { LABOUR_RATE_CENTS, formatAud, marginCents, marginPct } from "@/lib/money";
import { PIPELINE_LABEL, STAGES, STATUS_LABEL, nextStage } from "@/lib/pipeline";
import { getOrderDetail } from "@/lib/queries/orders";

export const metadata: Metadata = { title: "Job" };

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("/orders");
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const order = await getOrderDetail(id, user.role);
  if (!order) notFound();

  const stages = STAGES[order.pipeline];
  const reached = stages.indexOf(order.status);
  const next = nextStage(order.pipeline, order.status);

  // Admin only — the numbers simply are not present on an employee payload.
  let margin: { cents: number; pct: number; materials: number } | null = null;
  if (isAdmin && "quoteCents" in order) {
    const materials = order.lines.reduce(
      (t, l) => t + ("unitPriceCents" in l ? Math.round(l.sqm * (l.unitPriceCents ?? 0) * 0.45) : 0),
      0,
    );
    const cents = marginCents({
      quoteCents: order.quoteCents,
      materialCostCents: materials,
      labourHours: order.actualHours || order.estimatedHours,
      labourRateCents: LABOUR_RATE_CENTS,
    });
    margin = { cents, pct: marginPct(order.quoteCents, cents), materials };
  }

  return (
    <>
      <Link href={`/orders?pipeline=${order.pipeline}`} className="text-sm text-ink-2 underline-offset-4 hover:text-rose hover:underline">
        ← Back to {PIPELINE_LABEL[order.pipeline].toLowerCase()}
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-sm font-semibold tabular-nums text-rose">{order.jobNumber}</div>
          <h1 className="dsp mt-1 text-4xl">{order.customer.name.toLowerCase()}</h1>
          <p className="mt-2 text-ink-2">
            {order.address}, {order.suburb} · {order.customer.phone}
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <Pill tone={order.status === "COMPLETE" ? "good" : order.status === "LOST" ? "gone" : "busy"}>
            {STATUS_LABEL[order.status]}
          </Pill>
          {next ? <AdvanceButton orderId={order.id} to={next} label={`Move to ${STATUS_LABEL[next]}`} /> : null}
        </div>
      </header>

      {/* Stage track — shows where this job is on its own pipeline. */}
      <ol className="mt-8 flex flex-wrap gap-2">
        {stages.map((s, i) => (
          <li
            key={s}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold ${
              i < reached
                ? "border-line bg-blush-2 text-ink-2"
                : i === reached
                  ? "border-rose bg-rose text-white"
                  : "border-dashed border-line bg-transparent text-muted"
            }`}
          >
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ol>

      {isAdmin && "quoteCents" in order && margin ? (
        <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="p-5">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Quote</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{formatAud(order.quoteCents)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Deposit</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{formatAud(order.depositCents)}</div>
          </Card>
          <Card className="p-5">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Hours</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">
              {order.actualHours || order.estimatedHours}
            </div>
            <div className="text-xs text-ink-2">
              {order.actualHours ? `est. ${order.estimatedHours}` : "estimated"}
            </div>
          </Card>
          <Card className={`p-5 ${margin.cents < 0 ? "border-rose bg-blush" : ""}`}>
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Margin</div>
            <div className="mt-2 text-2xl font-extrabold tabular-nums">{formatAud(margin.cents)}</div>
            <div className="text-xs text-ink-2">{margin.pct}% of quote</div>
          </Card>
        </section>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <section>
          <SectionTitle>Cut list</SectionTitle>
          {order.lines.length === 0 ? (
            <Empty>No lines on this job yet.</Empty>
          ) : (
            <Card className="divide-y divide-line">
              {order.lines.map((l) => (
                <div key={l.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-semibold">{l.description}</div>
                    {isAdmin && "lineTotalCents" in l ? (
                      <div className="font-semibold tabular-nums">{formatAud(l.lineTotalCents ?? 0)}</div>
                    ) : null}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-ink-2">
                    <span className="tabular-nums">{l.sqm} m²</span>
                    <span className="tabular-nums">{l.labourHours} h</span>
                    {l.material ? (
                      <span>{l.material.name} · {l.material.finish} · {l.material.thicknessMm}mm</span>
                    ) : null}
                  </div>
                  {l.offcut ? (
                    <div className="mt-3 rounded-xl bg-blush px-4 py-2 text-xs">
                      Use offcut{" "}
                      <Link href="/offcuts" className="font-semibold text-rose underline-offset-4 hover:underline">
                        {l.offcut.ref}
                      </Link>{" "}
                      — {dims(l.offcut.widthMm, l.offcut.lengthMm)}, rack <b>{l.offcut.rack}</b>
                    </div>
                  ) : l.slab ? (
                    <div className="mt-3 rounded-xl bg-blush-2 px-4 py-2 text-xs">
                      Cut from slab{" "}
                      <Link href={`/stock/${l.slab.id}`} className="font-semibold text-rose underline-offset-4 hover:underline">
                        {l.slab.ref}
                      </Link>{" "}
                      — rack <b>{l.slab.rack}</b>
                    </div>
                  ) : null}
                </div>
              ))}
            </Card>
          )}

          <div className="mt-8">
            <SectionTitle>Stock movement</SectionTitle>
            {order.movements.length === 0 ? (
              <Empty>Nothing has moved for this job yet.</Empty>
            ) : (
              <Card className="divide-y divide-line">
                {order.movements.map((m) => (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                    <div className="flex items-center gap-3">
                      <Pill tone={m.kind === "CONSUMED" ? "neutral" : "busy"}>{m.kind.toLowerCase()}</Pill>
                      <span className="font-medium">{m.slab?.ref ?? m.offcut?.ref ?? "—"}</span>
                    </div>
                    <span className="text-xs text-ink-2">{m.user.name} · {when(m.createdAt)}</span>
                  </div>
                ))}
              </Card>
            )}
          </div>
        </section>

        <section>
          <SectionTitle>Booked in</SectionTitle>
          {order.events.length === 0 ? (
            <Empty>Not scheduled yet.</Empty>
          ) : (
            <Card className="divide-y divide-line">
              {order.events.map((e) => (
                <div key={e.id} className="px-5 py-4 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <Pill tone="busy">{e.kind.toLowerCase()}</Pill>
                    <span className="text-xs tabular-nums text-ink-2">
                      {e.startAt.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}{" "}
                      {e.startAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-ink-2">
                    {e.assignees.map((a) => a.user.name).join(", ") || "Nobody assigned"}
                  </div>
                </div>
              ))}
            </Card>
          )}

          <div className="mt-8">
            <SectionTitle>Customer</SectionTitle>
            <Card className="p-5 text-sm">
              <div className="font-semibold">{order.customer.name}</div>
              <div className="mt-1 text-ink-2">{order.customer.phone}</div>
              {"email" in order.customer && order.customer.email ? (
                <div className="text-ink-2">{order.customer.email}</div>
              ) : null}
              <div className="mt-2 text-xs text-ink-2">{order.customer.suburb}</div>
              {isAdmin && "source" in order.customer && order.customer.source ? (
                <div className="mt-3">
                  <Pill>{String(order.customer.source).replace(/_/g, " ").toLowerCase()}</Pill>
                </div>
              ) : null}
            </Card>
          </div>
        </section>
      </div>
    </>
  );
}
