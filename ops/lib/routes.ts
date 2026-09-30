/**
 * Which jobs are near enough to do in one run.
 *
 * Pure and free of the database, like lib/board.ts and lib/stage-timing.ts, so
 * the grouping rules are unit tested rather than only eyeballed on screen.
 *
 * What this deliberately does NOT do is order the stops. Suggesting a driving
 * order from suburb centroids would look precise while being wrong — the data
 * places a suburb, not a house, and the difference between two addresses within
 * one suburb is exactly what it cannot see. Grouping is the honest limit.
 */
import { distanceKm, suburbPoint, type Suburb } from "@/lib/suburbs";

/**
 * How far apart two jobs can be and still be worth doing together.
 *
 * Five kilometres is roughly ten minutes across Adelaide's suburbs — far enough
 * to catch the neighbouring-suburb case that exact matching misses, close
 * enough that the detour is not the job.
 */
export const DEFAULT_RADIUS_KM = 5;

/** The least a caller needs for a job to take part in grouping. */
export type Placeable = {
  id: string;
  suburb: string | null;
};

export type Located<T> = T & { point: Suburb; suburbName: string };

/**
 * Split jobs into the ones we can place and the ones we cannot.
 *
 * Kept explicit rather than filtering silently: a caller that wants to say
 * "3 of these 5 have no suburb we recognise" can, and the unplaceable ones are
 * never lost.
 */
export function locate<T extends Placeable>(
  jobs: readonly T[],
): { located: Located<T>[]; unplaced: T[] } {
  const located: Located<T>[] = [];
  const unplaced: T[] = [];

  for (const job of jobs) {
    const point = suburbPoint(job.suburb);
    if (point) located.push({ ...job, point, suburbName: point.name });
    else unplaced.push(job);
  }

  return { located, unplaced };
}

export type Nearby<T> = { job: Located<T>; km: number };

/**
 * Everything within `withinKm` of one job, nearest first.
 *
 * The target itself is never in the result. Two jobs in the same suburb come
 * back at zero, so an exact match always counts however small the radius.
 */
export function nearbyJobs<T extends Placeable>(
  target: T,
  candidates: readonly T[],
  withinKm = DEFAULT_RADIUS_KM,
): Nearby<T>[] {
  const from = suburbPoint(target.suburb);
  if (!from) return [];

  const { located } = locate(candidates);

  return located
    .filter((c) => c.id !== target.id)
    .map((job) => ({ job, km: distanceKm(from, job.point) }))
    .filter((n) => n.km <= withinKm)
    .sort((a, b) => a.km - b.km);
}

export type Run<T> = {
  /** Distinct suburbs in this run, nearest-to-first order of appearance. */
  suburbs: string[];
  jobs: Located<T>[];
  /** The furthest two jobs in the run are this far apart. */
  spreadKm: number;
};

/**
 * Group jobs into runs.
 *
 * Single-link clustering: a job joins a run if it is within the radius of *any*
 * job already in it. That is the right shape here — a run down one road is a
 * chain, not a circle — and the numbers are small enough (tens of jobs in a
 * week) that anything cleverer would cost more in explaining than it returns.
 *
 * Runs of one are included. "This job is on its own" is a useful answer, and
 * dropping them would make the counts not add up.
 */
export function clusterJobs<T extends Placeable>(
  jobs: readonly T[],
  withinKm = DEFAULT_RADIUS_KM,
): { runs: Run<T>[]; unplaced: T[] } {
  const { located, unplaced } = locate(jobs);

  const remaining = [...located];
  const runs: Run<T>[] = [];

  while (remaining.length > 0) {
    const seed = remaining.shift()!;
    const members: Located<T>[] = [seed];

    // Grow the run until nothing else is within reach of anything in it.
    let grew = true;
    while (grew) {
      grew = false;
      for (let i = remaining.length - 1; i >= 0; i--) {
        const candidate = remaining[i];
        const touches = members.some((m) => distanceKm(m.point, candidate.point) <= withinKm);
        if (touches) {
          members.push(candidate);
          remaining.splice(i, 1);
          grew = true;
        }
      }
    }

    runs.push({
      suburbs: [...new Set(members.map((m) => m.suburbName))],
      jobs: members,
      spreadKm: spread(members),
    });
  }

  // Biggest runs first: those are the ones worth acting on.
  runs.sort((a, b) => b.jobs.length - a.jobs.length);
  return { runs, unplaced };
}

/** The widest gap between any two jobs in a run, to one decimal. */
function spread<T>(members: readonly Located<T>[]): number {
  let widest = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const d = distanceKm(members[i].point, members[j].point);
      if (d > widest) widest = d;
    }
  }
  return Math.round(widest * 10) / 10;
}

/** "Prospect and Nailsworth", "Glenelg, Brighton and 2 more" — for a heading. */
export function describeRun(run: Run<unknown>): string {
  const [a, b, ...rest] = run.suburbs;
  if (!a) return "Nowhere placed";
  if (!b) return a;
  if (rest.length === 0) return `${a} and ${b}`;
  return `${a}, ${b} and ${rest.length} more`;
}
