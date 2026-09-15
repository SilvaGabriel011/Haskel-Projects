import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, Empty, Pill, SectionTitle, dims, sqm, when } from "@/components/ui";
import { requireAccess } from "@/lib/guard";
import { formatAud } from "@/lib/money";
import { getSlab } from "@/lib/queries/stock";

export const metadata: Metadata = { title: "Slab" };

export default async function SlabPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAccess("/stock");
  const isAdmin = user.role === "ADMIN";
  const { id } = await params;
  const slab = await getSlab(id, user.role);
  if (!slab) notFound();

  const remaining = slab.offcuts.filter((o) => o.status === "AVAILABLE").length;

  return (
    <>
      <Link href="/stock" className="text-sm text-ink-2 underline-offset-4 hover:text-rose hover:underline">
        ← Back to stock
      </Link>

      <header className="mt-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="dsp text-4xl">{slab.ref.toLowerCase()}</h1>
          <p className="mt-2 text-ink-2">
            {slab.material.name} · {slab.material.finish} · {slab.material.thicknessMm}mm
          </p>
        </div>
        <Pill tone={slab.status === "IN_STOCK" ? "good" : slab.status === "RESERVED" ? "busy" : "neutral"}>
          {slab.status.replace("_", " ").toLowerCase()}
        </Pill>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Size</div>
          <div className="mt-2 font-semibold tabular-nums">{dims(slab.widthMm, slab.lengthMm)}</div>
          <div className="text-xs text-ink-2">{sqm(slab.widthMm, slab.lengthMm)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Rack</div>
          <div className="mt-2 font-semibold">{slab.rack}</div>
          <div className="text-xs text-ink-2">Arrived {when(slab.arrivedAt)}</div>
        </Card>
        <Card className="p-5">
          <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Offcuts from it</div>
          <div className="mt-2 font-semibold tabular-nums">{slab.offcuts.length}</div>
          <div className="text-xs text-ink-2">{remaining} still available</div>
        </Card>
        {isAdmin && "costCents" in slab ? (
          <Card className="p-5">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Cost</div>
            <div className="mt-2 font-semibold tabular-nums">{formatAud(slab.costCents)}</div>
            <div className="text-xs text-ink-2">
              {"supplier" in slab.material ? slab.material.supplier : ""}
            </div>
          </Card>
        ) : (
          <Card className="p-5">
            <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">Material</div>
            <div className="mt-2 font-semibold">{slab.material.kind.toLowerCase()}</div>
            <div className="text-xs text-ink-2">{slab.material.finish}</div>
          </Card>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle aside={<Link href="/offcuts" className="text-xs text-rose underline-offset-4 hover:underline">All offcuts →</Link>}>
          Cut from this slab
        </SectionTitle>
        {slab.offcuts.length === 0 ? (
          <Empty>Nothing has been cut from this slab yet.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {slab.offcuts.map((o) => (
              <Card key={o.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="font-semibold">{o.ref}</div>
                  <Pill tone={o.status === "AVAILABLE" ? "good" : o.status === "RESERVED" ? "busy" : "gone"}>
                    {o.status.toLowerCase()}
                  </Pill>
                </div>
                <div className="mt-2 text-sm tabular-nums">{dims(o.widthMm, o.lengthMm)}</div>
                <div className="mt-1 text-xs text-ink-2">
                  {o.finish} · rack {o.rack}
                  {o.listedPublicly ? " · on the website" : ""}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <SectionTitle>History</SectionTitle>
        <Card className="divide-y divide-line">
          {slab.movements.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
              <div className="flex items-center gap-3">
                <Pill tone={m.kind === "RECEIVED" ? "good" : m.kind === "CONSUMED" ? "neutral" : "busy"}>
                  {m.kind.toLowerCase()}
                </Pill>
                <span>{m.note ?? "—"}</span>
              </div>
              <div className="text-xs text-ink-2">
                {m.order ? (
                  <Link href={`/orders/${m.order.id}`} className="text-rose underline-offset-4 hover:underline">
                    {m.order.jobNumber}
                  </Link>
                ) : null}{" "}
                {m.user.name} · {when(m.createdAt)}
              </div>
            </div>
          ))}
        </Card>
      </section>
    </>
  );
}
