import type { Metadata } from "next";
import Link from "next/link";

import { PageHead } from "@/components/page-head";
import { Card, Empty, FilterChips, Pill, SectionTitle, Tile } from "@/components/ui";
import {
  FILTER_LABEL,
  BOARD_FILTERS,
  isBoardFilter,
  matchesFilter,
  filterCounts,
  columnsFor,
  TONE_LABEL,
  type BoardCard,
  type BoardFilter,
  type Tone,
} from "@/lib/board";
import { requireAccess } from "@/lib/guard";
import { DEFAULT_RADIUS_KM, nearbyJobs } from "@/lib/routes";
import { PIPELINE_LABEL, STATUS_LABEL } from "@/lib/pipeline";
import { boardCards } from "@/lib/queries/board";

export const metadata: Metadata = { title: "Follow up" };

/** Green, amber, red — on the card's left edge, where the eye scans down. */
const EDGE: Record<Tone, string> = {
  ok: "border-l-[3px] border-l-[#3f8f63]",
  warn: "border-l-[3px] border-l-[#c8821f]",
  late: "border-l-[3px] border-l-rose",
};

const DOT: Record<Tone, string> = {
  ok: "bg-[#3f8f63]",
  warn: "bg-[#c8821f]",
  late: "bg-rose",
};

const TONE_PILL: Record<Tone, "good" | "warn" | "gone"> = {
  ok: "good",
  warn: "warn",
  late: "gone",
};

function JobCard({ card, nearby }: { card: BoardCard; nearby: number }) {
  return (
    <Link
      href={`/orders/${card.id}`}
      className={`block rounded-[14px] border border-line bg-white p-4 transition hover:-translate-y-0.5 hover:border-rose hover:shadow-lg ${EDGE[card.tone]}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold tabular-nums text-rose">{card.jobNumber}</span>
        <span
          aria-hidden="true"
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${DOT[card.tone]}`}
        />
      </div>

      <div className="mt-2 text-sm font-semibold">{card.customerName}</div>
      {card.suburb ? <div className="mt-0.5 text-xs text-ink-2">{card.suburb}</div> : null}
      {nearby > 0 ? (
        <div className="mt-1 text-xs text-rose">
          {nearby} other{nearby === 1 ? "" : "s"} within {DEFAULT_RADIUS_KM} km
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {/* The screen reader gets the state in words; the colour is a shortcut
            for people who can see it, never the only carrier of meaning. */}
        <span className="sr-only">{TONE_LABEL[card.tone]}.</span>
        <span
          className={`inline-block rounded-full px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.1em] ${
            card.ageTone === "ok"
              ? "bg-sand text-ink-2"
              : card.ageTone === "warn"
                ? "bg-[#fbeada] text-[#96581c]"
                : "bg-blush text-rose"
          }`}
        >
          {card.daysInStage}d in {STATUS_LABEL[card.status].toLowerCase()}
        </span>
        {card.datePassed ? <Pill tone="gone">date passed</Pill> : null}
      </div>

      {card.gaps.length ? (
        <ul className="mt-3 border-t border-line pt-2 text-xs">
          {card.gaps.map((g) => (
            <li key={g.field} className="flex items-center gap-1.5 py-0.5">
              <span
                aria-hidden="true"
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${g.blocking ? "bg-rose" : "bg-[#c8821f]"}`}
              />
              <span className={g.blocking ? "font-medium text-rose" : "text-ink-2"}>{g.label}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </Link>
  );
}

export default async function BoardPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; pipeline?: string }>;
}) {
  const user = await requireAccess("/board");
  const { show, pipeline: pipeParam } = await searchParams;

  const filter: BoardFilter = isBoardFilter(show) ? show : "attention";
  const pipeline = (["SHORT", "FULL"] as const).find((p) => p === pipeParam);

  const all = await boardCards(user.role);
  const counts = filterCounts(all);

  const scoped = pipeline ? all.filter((c) => c.pipeline === pipeline) : all;
  const cards = scoped.filter((c) => matchesFilter(c, filter));

  const late = all.filter((c) => c.tone === "late").length;
  const missing = all.filter((c) => c.gaps.length > 0).length;
  const blocked = all.filter((c) => c.gaps.some((g) => g.blocking)).length;
  const passed = all.filter((c) => c.datePassed).length;

  // How many other live jobs sit near each one. Computed over every job still
  // in flight, not just the filtered view: "2 others nearby" must not change
  // because a filter is on.
  const nearbyCount = new Map<string, number>(
    all.map((c) => [c.id, nearbyJobs(c, all).length]),
  );

  const stages = columnsFor();

  const byStage = new Map<string, BoardCard[]>(stages.map((s) => [s, []]));
  for (const c of cards) byStage.get(c.status)?.push(c);

  return (
    <>
      <PageHead
        eyebrow="What needs chasing"
        title={<>follow up</>}
        lede="Jobs still in flight, flagged by how long they have sat and by what the office is missing. Green is fine, amber is worth a look, red needs doing."
      />

      <section className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Still in flight" value={all.length} sub="Not complete, not lost" />
        <Tile label="Overdue" value={late} sub="Sat too long for its stage" />
        <Tile label="Missing details" value={missing} sub={`${blocked} cannot proceed`} />
        <Tile label="Date has passed" value={passed} sub="Booked, still not finished" />
      </section>

      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
        <FilterChips
          param="pipeline"
          basePath="/board"
          current={pipeline}
          options={(["SHORT", "FULL"] as const).map((p) => ({
            value: p,
            label: PIPELINE_LABEL[p],
            count: all.filter((c) => c.pipeline === p).length,
          }))}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {BOARD_FILTERS.map((f) => {
          const active = f === filter;
          const q = new URLSearchParams({ show: f });
          if (pipeline) q.set("pipeline", pipeline);
          return (
            <Link
              key={f}
              href={`/board?${q}`}
              aria-current={active ? "true" : undefined}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                active
                  ? "border-rose bg-rose text-white"
                  : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
              }`}
            >
              {FILTER_LABEL[f]}
              <span className={`ml-2 tabular-nums ${active ? "text-white/70" : "text-muted"}`}>
                {counts[f]}
              </span>
            </Link>
          );
        })}
      </div>

      {cards.length === 0 ? (
        <div className="mt-8">
          <Empty>
            {filter === "attention"
              ? "Nothing needs chasing. Every job in flight is on track and has the details it needs."
              : "No jobs match that filter."}
          </Empty>
        </div>
      ) : (
        <div className="mt-8 overflow-x-auto pb-4">
          <div className="flex gap-4" style={{ minWidth: `${stages.length * 250}px` }}>
            {stages.map((stage) => {
              const items = byStage.get(stage) ?? [];
              return (
                <section key={stage} className="flex-1 min-w-[236px]">
                  <div className="mb-3 flex items-baseline justify-between gap-2 px-1">
                    <h2 className="text-xs font-semibold uppercase tracking-[0.14em]">
                      {STATUS_LABEL[stage]}
                    </h2>
                    <span className="text-xs tabular-nums text-muted">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {items.length === 0 ? (
                      <div className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-xs text-muted">
                        Nothing here
                      </div>
                    ) : (
                      items.map((c) => <JobCard key={c.id} card={c} nearby={nearbyCount.get(c.id) ?? 0} />)
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      <section className="mt-10">
        <SectionTitle>What the colours mean</SectionTitle>
        <Card className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          {(["ok", "warn", "late"] as const).map((t) => (
            <div key={t} className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[t]}`} />
              <div>
                <div className="font-semibold">{TONE_LABEL[t]}</div>
                <p className="mt-1 text-xs text-ink-2">
                  {t === "ok"
                    ? "Moving along, and the office has what it needs."
                    : t === "warn"
                      ? "Sitting longer than usual for this stage, or missing something that can wait."
                      : "Well past time for its stage, a booked date gone by, or missing something that stops the job."}
                </p>
              </div>
            </div>
          ))}
        </Card>
        <p className="mt-3 text-xs text-muted">
          Days are counted in the stage a job is in, and the thresholds differ by stage — an
          enquiry goes amber after two days, fabrication after ten. A colour is never the only
          signal: every card also says in words what is wrong.{" "}
          <Pill tone={TONE_PILL.late}>red</Pill> on a detail means the job cannot proceed without it.
        </p>
      </section>
    </>
  );
}
