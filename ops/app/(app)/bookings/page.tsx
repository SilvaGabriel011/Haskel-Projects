import type { Metadata } from "next";
import Link from "next/link";

import { BookingRow } from "@/components/booking-row";
import { PageHead } from "@/components/page-head";
import { Card, Empty, Pill, SectionTitle, Tile } from "@/components/ui";
import { BOOKABLE_LABEL } from "@/lib/booking";
import { calendarConfigured } from "@/lib/google-calendar";
import { requireAdmin } from "@/lib/guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Booking requests" };

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ accepted?: string; at?: string; calendar?: string }>;
}) {
  await requireAdmin();
  const { accepted, at, calendar } = await searchParams;

  const [pending, decided, counts] = await Promise.all([
    db.bookingRequest.findMany({ where: { status: "NEW" }, orderBy: { preferredAt: "asc" } }),
    db.bookingRequest.findMany({
      where: { status: { not: "NEW" } },
      orderBy: { decidedAt: "desc" },
      take: 10,
      include: { order: { select: { id: true, jobNumber: true } } },
    }),
    db.bookingRequest.groupBy({ by: ["status"], _count: true }),
  ]);

  const n = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <>
      <PageHead
        eyebrow="From the website"
        title={<>booking <span className="it">requests</span></>}
        lede="Customers asking for a time. Nothing is in your diary until you accept one."
      />

      {accepted ? (
        <p
          role="status"
          className="mt-7 max-w-2xl rounded-[18px] border border-rose bg-blush px-6 py-4 text-sm"
        >
          <b>Booked as {accepted}</b>
          {at
            ? ` for ${new Date(at).toLocaleString("en-AU", {
                weekday: "short", day: "numeric", month: "short",
                hour: "numeric", minute: "2-digit",
              })}`
            : ""}
          .{" "}
          {calendar === "synced"
            ? "Added to the company calendar."
            : "Not on a calendar — Google is not connected yet, so it lives in the schedule here only."}
        </p>
      ) : null}

      <section className="mt-9 grid gap-4 sm:grid-cols-3">
        <Tile label="Waiting on you" value={n("NEW")} sub="Not booked yet" />
        <Tile label="Accepted" value={n("ACCEPTED")} sub="Became jobs" />
        <Tile label="Declined" value={n("DECLINED")} sub="Turned down" />
      </section>

      {!calendarConfigured() ? (
        <p className="mt-6 max-w-2xl rounded-[18px] border border-line bg-cream px-5 py-3 text-sm text-ink-2">
          Google Calendar is not connected, so accepting a request books it here but writes nothing
          to a calendar. Everything else works — the diary entry is real either way.
        </p>
      ) : null}

      <section className="mt-9">
        <SectionTitle>Waiting on you</SectionTitle>
        {pending.length === 0 ? (
          <Empty>No requests waiting. They arrive from the booking page on the website.</Empty>
        ) : (
          <Card className="divide-y divide-line">
            {pending.map((r) => (
              <BookingRow key={r.id} req={r} label={BOOKABLE_LABEL[r.jobType] ?? r.jobType} />
            ))}
          </Card>
        )}
      </section>

      {decided.length > 0 ? (
        <section className="mt-10">
          <SectionTitle>Recently decided</SectionTitle>
          <Card className="divide-y divide-line">
            {decided.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <span className="font-semibold">{r.name}</span>
                  <span className="text-ink-2"> · {r.suburb} · {BOOKABLE_LABEL[r.jobType] ?? r.jobType}</span>
                </div>
                <div className="flex items-center gap-3">
                  {r.order ? (
                    <Link href={`/orders/${r.order.id}`} className="text-xs text-rose underline-offset-4 hover:underline">
                      {r.order.jobNumber}
                    </Link>
                  ) : null}
                  <Pill tone={r.status === "ACCEPTED" ? "good" : "gone"}>{r.status.toLowerCase()}</Pill>
                </div>
              </div>
            ))}
          </Card>
        </section>
      ) : null}
    </>
  );
}
