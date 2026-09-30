import Link from "next/link";

import { Card, Empty, SectionTitle } from "@/components/ui";
import { formatTime } from "@/lib/business-time";
import { DEFAULT_RADIUS_KM, clusterJobs, describeRun } from "@/lib/routes";

/**
 * The week's work, grouped into runs by where it is.
 *
 * The system has no coordinates — only a free-text suburb — so a run means
 * "these jobs are in the same part of town", not a driving route. It stops
 * short of suggesting an order on purpose: that would look precise while being
 * guesswork, since the data places a suburb and not a house.
 */

export type RunnableEvent = {
  id: string;
  startAt: Date;
  order: { id: string; jobNumber: string; suburb: string | null } | null;
};

/**
 * A run is counted in visits, not jobs.
 *
 * One job can have two events in a week — a template on Tuesday and the install
 * on Wednesday — and those are two separate trips. Calling three events "3 jobs"
 * read as three customers when it was two.
 */
function distinctJobs(members: readonly { event: RunnableEvent }[]): number {
  return new Set(members.map((m) => m.event.order!.id)).size;
}

function visitCount(visits: number, jobs: number): string {
  const v = `${visits} visit${visits === 1 ? "" : "s"}`;
  return jobs === visits ? v : `${v} · ${jobs} jobs`;
}

export function WeekRuns({ events }: { events: RunnableEvent[] }) {
  // An internal event with no job behind it has no suburb to group on.
  const placeable = events
    .filter((e) => e.order !== null)
    .map((e) => ({ id: e.id, suburb: e.order!.suburb, event: e }));

  const { runs, unplaced } = clusterJobs(placeable);
  const grouped = runs.filter((r) => r.jobs.length > 1);

  if (placeable.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      <SectionTitle
        aside={
          <span className="text-xs text-muted">
            Visits within {DEFAULT_RADIUS_KM} km of each other
          </span>
        }
      >
        Runs this week
      </SectionTitle>

      {grouped.length === 0 ? (
        <Empty>
          Nothing this week is close enough to group. Jobs within{" "}
          {DEFAULT_RADIUS_KM} km of each other show up here as a run.
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {grouped.map((run) => (
            <Card key={run.jobs[0].id} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold">{describeRun(run)}</h3>
                <span className="shrink-0 text-xs tabular-nums text-muted">
                  {visitCount(run.jobs.length, distinctJobs(run.jobs))}
                </span>
              </div>
              <div className="mt-1 text-xs text-ink-2">
                {run.spreadKm === 0
                  ? "All in the one suburb"
                  : `Furthest two about ${run.spreadKm} km apart`}
              </div>

              <ul className="mt-4 divide-y divide-line border-t border-line">
                {run.jobs
                  .slice()
                  .sort((a, b) => a.event.startAt.getTime() - b.event.startAt.getTime())
                  .map((j) => (
                    <li key={j.id} className="py-2 text-sm">
                      <Link
                        href={`/orders/${j.event.order!.id}`}
                        className="font-medium underline-offset-4 hover:text-rose hover:underline"
                      >
                        {j.event.order!.jobNumber}
                      </Link>
                      <span className="text-ink-2">
                        {" — "}
                        {j.suburbName}, {formatTime(j.event.startAt)}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      {unplaced.length > 0 ? (
        <p className="mt-3 text-xs text-muted">
          {unplaced.length} job{unplaced.length === 1 ? "" : "s"} could not be placed — the
          suburb is blank or not one the system knows, so {unplaced.length === 1 ? "it is" : "they are"}{" "}
          left out of the grouping. {unplaced.length === 1 ? "It is" : "They are"} still in the week
          below.
        </p>
      ) : null}
    </section>
  );
}
