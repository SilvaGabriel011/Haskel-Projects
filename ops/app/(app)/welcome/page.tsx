import type { Metadata } from "next";
import Link from "next/link";

import { Clip } from "@/components/clip";
import { PageHead } from "@/components/page-head";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/guard";
import { stagesFor } from "@/lib/welcome";

import { finishWelcome } from "./actions";

export const metadata: Metadata = { title: "Welcome" };

/**
 * The first-login walkthrough.
 *
 * One page rather than a click-through wizard: it reads on a phone, it can be
 * skimmed, and anyone can come back to it from "Getting started" in the
 * sidebar. What it says about moving jobs comes from lib/pipeline via
 * lib/welcome, so it can never promise an installer a move the server refuses.
 */
export default async function WelcomePage() {
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";
  const first = user.name.split(" ")[0].toLowerCase();
  const stages = stagesFor(user.role);

  type Step = {
    title: string;
    body: React.ReactNode;
    href?: string;
    cta?: string;
    /** A short recording of it being done, from public/media/welcome. */
    clip?: { name: string; label: string };
  };

  const steps: Step[] = [
    {
      title: isAdmin ? "The week, for everyone" : "Your week",
      body: isAdmin
        ? "Schedule shows every template, install and repair booked this week. Filter by person to see one run, and see which jobs are near each other."
        : "Schedule shows the jobs you are on this week, with the address and who else is there. Start your day here.",
      href: "/schedule",
      cta: "Open the schedule",
    },
    {
      title: "How a job moves",
      body: (
        <>
          <p>
            Every job runs the same eleven stages, forward one at a time. On a job&rsquo;s page, the
            button offers the next stage — nothing else.{" "}
            {isAdmin
              ? "You can make every move."
              : "The office handles quoting, winning, ordering stone and invoicing; you move the work along the bench."}
          </p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {stages.map((s) => (
              <li key={s.status} className="flex items-start gap-3 rounded-xl border border-line bg-white px-3 py-2">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-sand text-[0.7rem] font-bold">
                  {s.number}
                </span>
                <span className="min-w-0 text-sm">
                  <b>{s.label}</b>
                  <span className="block text-xs text-ink-2">{s.help}</span>
                </span>
                {!s.canMove && s.number > 1 ? (
                  <span className="ml-auto shrink-0 rounded-full bg-blush px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.1em] text-rose">
                    Office
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {isAdmin ? (
            <p className="mt-3 text-xs text-ink-2">
              A job can be marked lost from its first three stages. Any stone it was holding goes back on the rack.
            </p>
          ) : null}
        </>
      ),
      href: "/orders",
      cta: "See the jobs",
      clip: { name: "move-a-job", label: "Moving a job on: open it, press the button for the next stage." },
    },
    ...(isAdmin
      ? [
          {
            title: "Opening a job by hand",
            body: (
              <>
                <p>
                  For the phone call, the builder, the walk-in: <b>New job</b> on Orders. Pick the client, or
                  create their profile as a person or a company. A company hiring you for its own customer is
                  the client and pays; put the homeowner under <i>Who is the job for?</i> so installers know
                  who to ring.
                </p>
                <p className="mt-2">
                  The stone can wait for the quote, or be chosen now: type, then colour, thickness and finish.
                </p>
              </>
            ),
            href: "/orders/new",
            cta: "Open a job",
            clip: { name: "open-a-job", label: "Opening a job for a company, with the homeowner and the stone." },
          },
        ]
      : []),
    {
      title: "What needs chasing",
      body: "Follow up flags jobs that have sat in one stage for three days (amber) or five (red), jobs missing details like a phone number or cut list, and bookings that have come and gone.",
      href: "/board",
      cta: "Open follow up",
    },
    {
      title: "Stock and offcuts",
      body: isAdmin
        ? "Every slab and offcut is on the rack with its size and where it lives. Add stock on the Stock page: pick the type of stone, then the colour; thickness and finish are dropdowns too. Hold a piece for a job from the job’s page so nobody else takes it."
        : "Every slab and offcut is on the rack with its size and where it lives. Hold a piece for a job from the job’s page so nobody else takes it; release it if the plan changes.",
      href: isAdmin ? "/stock" : "/offcuts",
      cta: isAdmin ? "Open stock" : "See the rack",
      ...(isAdmin
        ? { clip: { name: "add-stock", label: "Adding an offcut: type of stone, colour, size, rack." } }
        : {}),
    },
    ...(isAdmin
      ? [
          {
            title: "Bookings from the website",
            body: "Customers ask for a time; nothing is booked until you accept. Accepting makes the job and puts the measure in your diary — you are warned if it clashes.",
            href: "/bookings",
            cta: "Open bookings",
          },
          {
            title: "Money and people",
            body: "Financials shows revenue and margin on finished jobs. Settings is where you add staff, choose admin or employee, and switch someone off — it takes effect on their next click.",
            href: "/financials",
            cta: "Open financials",
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHead
        eyebrow="Getting started"
        title={
          <>
            welcome, <span className="it">{first}</span>
          </>
        }
        lede={
          isAdmin
            ? "A few minutes on how Haskel Ops works. You can see and change everything, money included."
            : "A few minutes on how Haskel Ops works, then you are into it. Come back any time from “Getting started” in the menu."
        }
      />

      <ol className="mt-9 grid max-w-3xl gap-5">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Card className="p-6">
              <div className="flex items-start gap-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-sm font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold">{step.title}</h2>
                  <div className="mt-2 text-sm leading-relaxed text-ink-2">{step.body}</div>
                  {step.clip ? (
                    <Clip src={`/media/welcome/${step.clip.name}`} label={step.clip.label} />
                  ) : null}
                  {step.href ? (
                    <Link
                      href={step.href}
                      className="mt-4 inline-block text-sm font-semibold text-rose underline-offset-4 hover:underline"
                    >
                      {step.cta} →
                    </Link>
                  ) : null}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      {!isAdmin ? (
        <p className="mt-6 max-w-3xl text-sm text-ink-2">
          Prices, costs and margins stay with the office — you will not see them anywhere, and that is on
          purpose, not a fault.
        </p>
      ) : null}

      <form action={finishWelcome} className="mt-8">
        <button
          type="submit"
          className="rounded-full bg-rose px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-deep"
        >
          I&rsquo;m ready — take me to the dashboard
        </button>
      </form>
    </>
  );
}
