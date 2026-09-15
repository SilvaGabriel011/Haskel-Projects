import type { Metadata } from "next";
import Link from "next/link";

import { PageHead } from "@/components/page-head";
import { Card, Empty, FilterChips, Pill, SectionTitle, Tile, dims, sqm, when } from "@/components/ui";
import { requireAccess } from "@/lib/guard";
import { listOffcuts, stockCounts } from "@/lib/queries/stock";
import type { OffcutStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Offcuts" };

const LABEL: Record<OffcutStatus, string> = {
  AVAILABLE: "Available",
  RESERVED: "Reserved",
  SOLD: "Sold",
};

export default async function OffcutsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; listed?: string }>;
}) {
  await requireAccess("/offcuts");
  const { status, listed } = await searchParams;
  const filter = (["AVAILABLE", "RESERVED", "SOLD"] as const).find((s) => s === status);
  const listedOnly = listed === "1";

  const [offcuts, counts] = await Promise.all([
    listOffcuts({ ...(filter ? { status: filter } : {}), listedOnly }),
    stockCounts(),
  ]);

  return (
    <>
      <PageHead
        eyebrow="The specialty"
        title={<>what is on the <span className="it">rack</span></>}
        lede="Remnants with a parent slab, a size and a home. These are what the website sends people in to ask about."
      />

      <section className="mt-9 grid gap-4 sm:grid-cols-3">
        <Tile label="Available" value={counts.offcutsAvailable} sub="Ready to quote against" />
        <Tile label="Showing on the website" value={counts.offcutsListed} sub="Visible on the public offcuts page" />
        <Tile label="Slabs in stock" value={counts.slabsInStock} sub="More offcuts come off these" href="/stock" />
      </section>

      <div className="mt-9 flex flex-wrap items-center gap-3">
        <FilterChips
          param="status"
          basePath="/offcuts"
          current={filter}
          options={(["AVAILABLE", "RESERVED", "SOLD"] as const).map((s) => ({ value: s, label: LABEL[s] }))}
        />
        <Link
          href={listedOnly ? "/offcuts" : "/offcuts?listed=1"}
          className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
            listedOnly
              ? "border-rose bg-rose text-white"
              : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
          }`}
        >
          On the website only
        </Link>
      </div>

      <SectionTitle aside={<span className="text-xs text-ink-2">{offcuts.length} shown</span>}>
        <span className="sr-only">Offcuts</span>
      </SectionTitle>

      {offcuts.length === 0 ? (
        <Empty>No offcuts match that filter.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {offcuts.map((o) => (
            <Card key={o.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold">{o.material.name}</div>
                  <div className="text-xs text-ink-2">{o.ref}</div>
                </div>
                <Pill tone={o.status === "AVAILABLE" ? "good" : o.status === "RESERVED" ? "busy" : "gone"}>
                  {LABEL[o.status]}
                </Pill>
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="border-l-2 border-blush pl-3">
                  <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink-2">Size</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums whitespace-nowrap">{dims(o.widthMm, o.lengthMm)}</dd>
                </div>
                <div className="border-l-2 border-blush pl-3">
                  <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink-2">Area</dt>
                  <dd className="mt-0.5 font-semibold tabular-nums">{sqm(o.widthMm, o.lengthMm)}</dd>
                </div>
                <div className="border-l-2 border-blush pl-3">
                  <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink-2">Finish</dt>
                  <dd className="mt-0.5 font-semibold">{o.finish}</dd>
                </div>
                <div className="border-l-2 border-blush pl-3">
                  <dt className="text-[0.62rem] font-semibold uppercase tracking-[0.12em] text-ink-2">Rack</dt>
                  <dd className="mt-0.5 font-semibold">{o.rack}</dd>
                </div>
              </dl>

              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-xs text-ink-2">
                {o.parentSlab ? (
                  <Link href={`/stock/${o.parentSlab.id}`} className="text-rose underline-offset-4 hover:underline">
                    from {o.parentSlab.ref}
                  </Link>
                ) : (
                  <span>no parent slab recorded</span>
                )}
                <span>·</span>
                <span>{when(o.createdAt)}</span>
                {o.listedPublicly ? (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-rose">on the website</span>
                  </>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
