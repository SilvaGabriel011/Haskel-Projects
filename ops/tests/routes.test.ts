/**
 * Grouping jobs into runs.
 *
 * The behaviour that matters most is the quiet one: a job whose suburb nobody
 * recognises must carry on existing. Silently dropping it would mean the board
 * shows fewer jobs than there are, which is worse than not grouping at all.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEFAULT_RADIUS_KM,
  clusterJobs,
  describeRun,
  locate,
  nearbyJobs,
} from "../lib/routes";

const job = (id: string, suburb: string | null) => ({ id, suburb });

describe("placing a list of jobs", () => {
  it("separates what it can place from what it cannot", () => {
    const { located, unplaced } = locate([
      job("a", "Prospect"),
      job("b", "Nowhereville"),
      job("c", "glenelg sa"),
      job("d", null),
    ]);
    assert.deepEqual(located.map((l) => l.id), ["a", "c"]);
    assert.deepEqual(located.map((l) => l.suburbName), ["Prospect", "Glenelg"]);
    assert.deepEqual(unplaced.map((u) => u.id), ["b", "d"]);
  });

  it("never loses a job", () => {
    const jobs = [job("a", "Prospect"), job("b", "???"), job("c", null)];
    const { located, unplaced } = locate(jobs);
    assert.equal(located.length + unplaced.length, jobs.length);
  });
});

describe("what is near one job", () => {
  const jobs = [
    job("self", "Glenelg"),
    job("close", "Brighton"),       // a few km down the coast
    job("same", "Glenelg"),         // same suburb, so zero
    job("far", "Modbury"),          // other side of the city
    job("nowhere", "Nowhereville"),
  ];

  it("lists them nearest first and leaves out the job itself", () => {
    const near = nearbyJobs(jobs[0], jobs);
    assert.deepEqual(near.map((n) => n.job.id), ["same", "close"]);
    assert.equal(near[0].km, 0);
  });

  it("counts the same suburb however small the radius", () => {
    const near = nearbyJobs(jobs[0], jobs, 0.1);
    assert.deepEqual(near.map((n) => n.job.id), ["same"]);
  });

  it("leaves out anything past the radius", () => {
    assert.ok(!nearbyJobs(jobs[0], jobs).some((n) => n.job.id === "far"));
  });

  it("finds nothing for a job it cannot place, rather than throwing", () => {
    assert.deepEqual(nearbyJobs(job("x", "Nowhereville"), jobs), []);
    assert.deepEqual(nearbyJobs(job("x", null), jobs), []);
  });

  it("widens with the radius", () => {
    assert.ok(nearbyJobs(jobs[0], jobs, 50).some((n) => n.job.id === "far"));
  });
});

describe("grouping a week into runs", () => {
  it("puts a cluster together and leaves the outlier alone", () => {
    const { runs } = clusterJobs([
      job("a", "Glenelg"),
      job("b", "Brighton"),
      job("c", "Modbury"),
    ]);
    assert.equal(runs.length, 2);
    // Biggest first.
    assert.deepEqual(runs[0].jobs.map((j) => j.id).sort(), ["a", "b"]);
    assert.deepEqual(runs[1].jobs.map((j) => j.id), ["c"]);
  });

  it("keeps a run of one — being on its own is a useful answer", () => {
    const { runs } = clusterJobs([job("a", "Modbury")]);
    assert.equal(runs.length, 1);
    assert.equal(runs[0].jobs.length, 1);
    assert.equal(runs[0].spreadKm, 0);
  });

  it("chains along a road rather than needing every pair to be close", () => {
    // Single link: A–B are close and B–C are close, so all three are one run
    // even though A–C is further than the radius. A run down one road is a
    // chain, not a circle.
    const { runs } = clusterJobs(
      [job("a", "Semaphore"), job("b", "Port Adelaide"), job("c", "West Lakes")],
      5,
    );
    assert.equal(runs.length, 1);
    assert.equal(runs[0].jobs.length, 3);
    assert.ok(runs[0].spreadKm > 0);
  });

  it("hands back what it could not place instead of dropping it", () => {
    const { runs, unplaced } = clusterJobs([
      job("a", "Glenelg"),
      job("b", "Nowhereville"),
      job("c", null),
    ]);
    assert.equal(runs.length, 1);
    assert.deepEqual(unplaced.map((u) => u.id), ["b", "c"]);
  });

  it("accounts for every job given to it", () => {
    const jobs = [
      job("a", "Glenelg"), job("b", "Brighton"), job("c", "Modbury"),
      job("d", "Nowhereville"), job("e", "Prospect"),
    ];
    const { runs, unplaced } = clusterJobs(jobs);
    const grouped = runs.reduce((n, r) => n + r.jobs.length, 0);
    assert.equal(grouped + unplaced.length, jobs.length);
  });

  it("puts everything in one run when the radius is wide enough", () => {
    const { runs } = clusterJobs([job("a", "Glenelg"), job("b", "Modbury")], 100);
    assert.equal(runs.length, 1);
  });

  it("splits everything apart when the radius is nothing", () => {
    const { runs } = clusterJobs([job("a", "Glenelg"), job("b", "Brighton")], 0);
    assert.equal(runs.length, 2);
  });

  it("copes with nothing at all", () => {
    const { runs, unplaced } = clusterJobs([]);
    assert.deepEqual(runs, []);
    assert.deepEqual(unplaced, []);
  });

  it("uses five kilometres unless told otherwise", () => {
    assert.equal(DEFAULT_RADIUS_KM, 5);
  });
});

describe("naming a run", () => {
  const run = (suburbs: string[]) => ({ suburbs, jobs: [], spreadKm: 0 });

  it("names one, two, or two and a count", () => {
    assert.equal(describeRun(run(["Prospect"])), "Prospect");
    assert.equal(describeRun(run(["Prospect", "Nailsworth"])), "Prospect and Nailsworth");
    assert.equal(
      describeRun(run(["Glenelg", "Brighton", "Marion", "Mitcham"])),
      "Glenelg, Brighton and 2 more",
    );
  });

  it("says something rather than nothing when there are no suburbs", () => {
    assert.equal(describeRun(run([])), "Nowhere placed");
  });
});
