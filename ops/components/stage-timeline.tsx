import { Card, SectionTitle } from "@/components/ui";
import { formatDate } from "@/lib/business-time";
import { STAGE_LABEL } from "@/lib/pipeline";
import {
  TIMING_LABEL,
  buildTimeline,
  timeShares,
  type StageRow,
  type TimingTone,
} from "@/lib/stage-timing";

/**
 * Where a job's time actually went.
 *
 * Filled in automatically every time the job moves stage — nobody types any of
 * this. Hours are calendar time, not working time: a job sitting over a weekend
 * has genuinely sat over the weekend, and pretending otherwise flatters it.
 */

const DOT: Record<TimingTone, string> = {
  ok: "bg-[#3f8f63] text-white",
  over3: "bg-[#c8821f] text-white",
  over5: "bg-rose text-white",
  live: "bg-white text-rose ring-2 ring-rose",
};

const CHIP: Record<TimingTone, string> = {
  ok: "bg-[#e7f2ec] text-[#276146]",
  over3: "bg-[#fbeada] text-[#96581c]",
  over5: "bg-blush text-rose",
  live: "bg-blush text-rose",
};

const BAR: Record<TimingTone, string> = {
  ok: "bg-[#3f8f63]",
  over3: "bg-[#c8821f]",
  over5: "bg-rose",
  live: "bg-[#2f5b8a]",
};

// In the business's zone: this renders on the server, which runs in UTC, and
// a 9:30am move in Adelaide used to read "00:00".
function when(d: Date) {
  return formatDate(d, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function StageTimeline({ rows }: { rows: StageRow[] }) {
  const t = buildTimeline(rows);
  const shares = timeShares(t);

  if (t.spells.length === 0) {
    return (
      <section className="mt-10">
        <SectionTitle>Stage timeline</SectionTitle>
        <Card className="p-6 text-sm text-ink-2">
          No stage history yet. It fills in by itself each time the job moves on.
        </Card>
      </section>
    );
  }

  return (
    <section className="mt-10">
      <SectionTitle
        aside={
          <span className="text-xs text-muted">
            Filled in automatically every time the job moves stage. Hours are calendar time.
          </span>
        }
      >
        Stage timeline
      </SectionTitle>

      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Figure label="Total job time" value={`${t.totalHours} h`} sub={`${t.totalDays} days`} />
          <Figure
            label={t.current ? "Current stage" : "Finished"}
            value={t.current ? t.current.label : "—"}
            sub={t.current ? `${t.current.human} so far` : "Nothing running"}
            tone={t.current ? "live" : undefined}
          />
          <Figure
            label="Longest stage"
            value={t.longest?.label ?? "—"}
            sub={t.longest ? `${t.longest.hours} h` : ""}
          />
          <Figure label="Stages completed" value={`${t.completed}`} sub={`of ${t.ofStages}`} />
        </div>

        {/* The dots. Horizontally scrollable rather than wrapped: eleven stages
            in a row is the shape people read, and wrapping breaks the line. */}
        <div className="mt-8 overflow-x-auto pb-2">
          <ol className="flex min-w-[980px] items-start gap-0">
            {t.all.map((s, i) => {
              const spell = s.spell;
              const tone: TimingTone = spell ? spell.tone : "ok";
              const started = spell !== null;
              return (
                <li key={s.stage} className="relative flex-1 text-center">
                  {/* The connecting rule, drawn behind the dot. */}
                  {i > 0 ? (
                    <span
                      aria-hidden="true"
                      className={`absolute left-[-50%] top-4 h-0.5 w-full ${
                        started ? "bg-[#3f8f63]" : "bg-line"
                      }`}
                    />
                  ) : null}

                  <div
                    className={`relative mx-auto grid h-8 w-8 place-items-center rounded-full text-xs font-bold ${
                      started ? DOT[tone] : "bg-white text-muted ring-1 ring-line"
                    }`}
                  >
                    {started && !spell?.live ? "✓" : s.number}
                  </div>

                  <div className="mt-2 px-1 text-[0.7rem] font-semibold leading-tight">
                    {s.label}
                  </div>

                  {spell ? (
                    <>
                      <div
                        className={`mx-auto mt-2 inline-block rounded-full px-2.5 py-1 text-[0.7rem] font-bold tabular-nums ${CHIP[tone]}`}
                      >
                        {spell.hours} h
                      </div>
                      <div className="mt-1.5 text-[0.65rem] leading-relaxed text-muted">
                        <div>{spell.human}</div>
                        <div>In {when(spell.enteredAt)}</div>
                        {spell.exitedAt ? (
                          <div>Out {when(spell.exitedAt)}</div>
                        ) : (
                          <div className="font-semibold text-rose">Still here</div>
                        )}
                        {spell.movedBy ? <div>Moved by {spell.movedBy}</div> : null}
                      </div>
                    </>
                  ) : (
                    <div className="mt-2 text-[0.65rem] text-muted">Not started</div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>

        {shares.length ? (
          <div className="mt-8">
            <div className="mb-2 flex items-baseline justify-between text-[0.62rem] font-semibold uppercase tracking-[0.14em] text-muted">
              <span>Where the time went</span>
              <span className="tabular-nums">{t.totalHours} h total</span>
            </div>
            <div className="flex h-6 overflow-hidden rounded-md">
              {shares.map((s, i) => (
                <div
                  key={`${s.stage}-${i}`}
                  className={`grid place-items-center text-[0.6rem] font-bold text-white ${BAR[s.tone]}`}
                  style={{ width: `${s.pct}%` }}
                  title={`${s.label} — ${s.pct}%`}
                >
                  {s.showLabel ? `${s.label} ${Math.round(s.pct)}%` : ""}
                </div>
              ))}
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[0.65rem] text-ink-2">
              {(["ok", "over3", "over5", "live"] as const).map((tone) => (
                <li key={tone} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-sm ${BAR[tone]}`} aria-hidden="true" />
                  {TIMING_LABEL[tone]}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Card>
    </section>
  );
}

function Figure({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: TimingTone;
}) {
  return (
    <div className={`rounded-[14px] border p-4 ${tone === "live" ? "border-rose bg-blush" : "border-line bg-cream"}`}>
      <div className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </div>
      <div className="mt-1.5 text-lg font-extrabold leading-tight tracking-tight">{value}</div>
      {sub ? <div className="mt-0.5 text-xs text-ink-2">{sub}</div> : null}
    </div>
  );
}

export { STAGE_LABEL };
