import type { Metadata } from "next";
import Link from "next/link";

import { PageHead } from "@/components/page-head";
import { Card, Empty, Pill } from "@/components/ui";
import { requireAccess } from "@/lib/guard";
import { addDays, byDay, crew, listWeek, visibleTo, weekStart } from "@/lib/queries/schedule";

export const metadata: Metadata = { title: "Schedule" };

const KIND_TONE = {
  TEMPLATE: "busy",
  FABRICATE: "neutral",
  INSTALL: "good",
  REPAIR: "warn",
  DELIVERY: "neutral",
} as const;

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; who?: string }>;
}) {
  const user = await requireAccess("/schedule");
  const isAdmin = user.role === "ADMIN";
  const { week, who } = await searchParams;

  const anchor = week ? new Date(week) : new Date();
  const from = weekStart(Number.isNaN(anchor.getTime()) ? new Date() : anchor);

  // An employee's filter is not a preference — it is the limit of what they see.
  const filterId = visibleTo(user.role, user.id, who);

  const [events, people] = await Promise.all([listWeek(from, filterId), isAdmin ? crew() : Promise.resolve([])]);
  const days = byDay(events, from);

  const prev = addDays(from, -7).toISOString().slice(0, 10);
  const next = addDays(from, 7).toISOString().slice(0, 10);
  const qs = (w: string, p?: string) => `/schedule?week=${w}${p ? `&who=${p}` : ""}`;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <>
      <PageHead
        eyebrow={isAdmin ? "Everyone's week" : "Your week"}
        title={<>schedule</>}
        lede={
          isAdmin
            ? "Templates, installs and repairs. Filter by person to see one run."
            : "The jobs you are on. Tap one for the address and the cut list."
        }
      />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Link href={qs(prev, who)} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:border-rose hover:text-rose">
            ← Previous
          </Link>
          <Link href={qs(next, who)} className="rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold transition hover:border-rose hover:text-rose">
            Next →
          </Link>
        </div>
        <div className="text-sm text-ink-2">
          Week of{" "}
          <b>{from.toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}</b>
          {" · "}
          <span className="tabular-nums">{events.length}</span> booked
        </div>
      </div>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/schedule?week=${from.toISOString().slice(0, 10)}`}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              !who ? "border-rose bg-rose text-white" : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
            }`}
          >
            Everyone
          </Link>
          {people.map((c) => (
            <Link
              key={c.id}
              href={qs(from.toISOString().slice(0, 10), c.id)}
              className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                who === c.id ? "border-rose bg-rose text-white" : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : null}

      {events.length === 0 ? (
        <div className="mt-8"><Empty>Nothing booked this week.</Empty></div>
      ) : (
        <div className="mt-8 overflow-x-auto pb-4">
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(7, minmax(190px, 1fr))" }}>
            {days.map((list, i) => {
              const date = addDays(from, i);
              const isToday = date.getTime() === today.getTime();
              return (
                <section key={i}>
                  <div
                    className={`mb-3 rounded-xl px-3 py-2 ${isToday ? "bg-rose text-white" : "bg-sand"}`}
                  >
                    <div className="text-[0.62rem] font-bold uppercase tracking-[0.14em]">
                      {DAY_NAMES[i]}
                    </div>
                    <div className="text-sm font-semibold tabular-nums">
                      {date.toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    {list.length === 0 ? (
                      <div className="rounded-[14px] border border-dashed border-line px-3 py-5 text-center text-xs text-muted">
                        —
                      </div>
                    ) : (
                      list.map((e) => (
                        <Card key={e.id} className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold tabular-nums">
                              {e.startAt.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}
                            </span>
                            <Pill tone={KIND_TONE[e.kind]}>{e.kind.toLowerCase()}</Pill>
                          </div>
                          {e.order ? (
                            <Link
                              href={`/orders/${e.order.id}`}
                              className="mt-2 block text-sm font-semibold underline-offset-4 hover:text-rose hover:underline"
                            >
                              {e.order.customer.name}
                            </Link>
                          ) : (
                            <div className="mt-2 text-sm font-semibold">Internal</div>
                          )}
                          <div className="mt-1 text-xs text-ink-2">{e.address}</div>
                          <div className="mt-2 border-t border-line pt-2 text-[0.68rem] text-ink-2">
                            {e.assignees.map((a) => a.user.name.split(" ")[0]).join(", ") || "Unassigned"}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}

      {!isAdmin ? (
        <p className="mt-8 max-w-2xl text-sm text-ink-2">
          You are seeing your own bookings. Asking for someone else&rsquo;s does not widen it —
          the limit is applied on the server, not in this page.
        </p>
      ) : null}
    </>
  );
}
