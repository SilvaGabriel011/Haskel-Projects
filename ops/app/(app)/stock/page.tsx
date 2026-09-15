import type { Metadata } from "next";
import Link from "next/link";

import { PageHead } from "@/components/page-head";
import { Card, Empty, FilterChips, Pill, SectionTitle, Tile, dims, sqm, when } from "@/components/ui";
import { requireAccess } from "@/lib/guard";
import { formatAud } from "@/lib/money";
import {
  listConsumables, listSlabs, lowStockConsumables, recentMovements, stockCounts, stockValueCents,
} from "@/lib/queries/stock";
import type { SlabStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Stock" };

const SLAB_TONE: Record<SlabStatus, "good" | "busy" | "neutral" | "gone"> = {
  IN_STOCK: "good",
  RESERVED: "busy",
  CUT: "neutral",
  SOLD: "gone",
};

const SLAB_LABEL: Record<SlabStatus, string> = {
  IN_STOCK: "In stock",
  RESERVED: "Reserved",
  CUT: "Cut",
  SOLD: "Sold",
};

export default async function StockPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await requireAccess("/stock");
  const isAdmin = user.role === "ADMIN";
  const { status } = await searchParams;
  const filter = (["IN_STOCK", "RESERVED", "CUT", "SOLD"] as const).find((s) => s === status);

  const [slabs, counts, low, consumables, movements, valueCents] = await Promise.all([
    listSlabs(user.role, filter ? { status: filter } : {}),
    stockCounts(),
    lowStockConsumables(),
    listConsumables(user.role),
    recentMovements(8),
    isAdmin ? stockValueCents() : Promise.resolve(0),
  ]);

  return (
    <>
      <PageHead
        eyebrow="The rack and the shed"
        title={<>stock</>}
        lede="Every slab you hold, what has been cut from it, and what is running low."
      />

      <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Slabs in stock" value={counts.slabsInStock} sub={`${counts.slabsReserved} reserved`} />
        <Tile label="Offcuts available" value={counts.offcutsAvailable} sub={`${counts.offcutsListed} on the website`} href="/offcuts" />
        <Tile label="Low on consumables" value={counts.lowStock} sub={low.length ? low.map((c) => c.name).slice(0, 2).join(", ") : "Nothing to reorder"} />
        {isAdmin ? (
          <Tile label="Value on the rack" value={formatAud(valueCents)} sub="In stock and reserved, at cost" />
        ) : (
          <Tile label="Racks in use" value={new Set(slabs.map((s) => s.rack[0])).size} sub="A, B and C bays" />
        )}
      </section>

      {low.length ? (
        <Card className="mt-8 border-rose bg-blush p-5">
          <SectionTitle>Reorder</SectionTitle>
          <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {low.map((c) => (
              <li key={c.id}>
                <b>{c.name}</b> — {c.qtyOnHand} {c.unit}
                {c.qtyOnHand === 1 ? "" : "s"} left, reorder at {c.reorderPoint}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <section className="mt-10">
        <SectionTitle
          aside={<span className="text-xs text-ink-2">{slabs.length} shown</span>}
        >
          Slabs
        </SectionTitle>
        <div className="mb-5">
          <FilterChips
            param="status"
            basePath="/stock"
            current={filter}
            options={(["IN_STOCK", "RESERVED", "CUT", "SOLD"] as const).map((s) => ({
              value: s,
              label: SLAB_LABEL[s],
            }))}
          />
        </div>

        {slabs.length === 0 ? (
          <Empty>No slabs match that filter.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-[18px] border border-line bg-white">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="bg-sand text-left text-[0.62rem] uppercase tracking-[0.14em]">
                  <th className="px-5 py-3 font-semibold">Ref</th>
                  <th className="px-5 py-3 font-semibold">Material</th>
                  <th className="px-5 py-3 font-semibold">Size</th>
                  <th className="px-5 py-3 font-semibold">Rack</th>
                  <th className="px-5 py-3 font-semibold">Offcuts</th>
                  {isAdmin ? <th className="px-5 py-3 text-right font-semibold">Cost</th> : null}
                  <th className="px-5 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {slabs.map((s) => (
                  <tr key={s.id} className="border-t border-line hover:bg-blush-2">
                    <td className="px-5 py-3">
                      <Link href={`/stock/${s.id}`} className="font-semibold underline-offset-4 hover:underline">
                        {s.ref}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      {s.material.name}
                      <span className="block text-xs text-ink-2">
                        {s.material.finish} · {s.material.thicknessMm}mm
                      </span>
                    </td>
                    <td className="px-5 py-3 tabular-nums">
                      {dims(s.widthMm, s.lengthMm)}
                      <span className="block text-xs text-ink-2">{sqm(s.widthMm, s.lengthMm)}</span>
                    </td>
                    <td className="px-5 py-3 font-medium">{s.rack}</td>
                    <td className="px-5 py-3 tabular-nums">{s._count.offcuts || "—"}</td>
                    {isAdmin && "costCents" in s ? (
                      <td className="px-5 py-3 text-right tabular-nums">{formatAud(s.costCents)}</td>
                    ) : null}
                    <td className="px-5 py-3">
                      <Pill tone={SLAB_TONE[s.status]}>{SLAB_LABEL[s.status]}</Pill>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle>Consumables</SectionTitle>
          <Card className="divide-y divide-line">
            {consumables.map((c) => {
              const short = c.qtyOnHand <= c.reorderPoint;
              return (
                <div key={c.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-ink-2">
                      Reorder at {c.reorderPoint}
                      {isAdmin && "unitCostCents" in c ? ` · ${formatAud(c.unitCostCents)} each` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="tabular-nums font-semibold">
                      {c.qtyOnHand} <span className="text-xs font-normal text-ink-2">{c.unit}</span>
                    </span>
                    {short ? <Pill tone="warn">Low</Pill> : null}
                  </div>
                </div>
              );
            })}
          </Card>
        </section>

        <section>
          <SectionTitle>Recent movement</SectionTitle>
          <Card className="divide-y divide-line">
            {movements.map((m) => (
              <div key={m.id} className="px-5 py-3 text-sm">
                <div className="flex items-center gap-2">
                  <Pill tone={m.kind === "RECEIVED" ? "good" : m.kind === "CONSUMED" ? "neutral" : "busy"}>
                    {m.kind.toLowerCase()}
                  </Pill>
                  <span className="font-medium">
                    {m.slab?.ref ?? m.offcut?.ref ?? m.consumable?.name ?? "—"}
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-2">
                  {m.note ? `${m.note} · ` : ""}
                  {m.user.name} · {when(m.createdAt)}
                </div>
              </div>
            ))}
          </Card>
        </section>
      </div>
    </>
  );
}
