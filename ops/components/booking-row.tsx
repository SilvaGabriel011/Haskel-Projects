"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptBooking, declineBooking } from "@/app/(app)/bookings/actions";
import { Pill } from "@/components/ui";

type Clash = { eventId: string; kind: string; startAt: Date; endAt: Date; jobNumber: string | null; people: string[] };
type Twin = { id: string; status: string; createdAt: Date; preferredAt: Date };

type Req = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  suburb: string;
  jobType: string;
  notes: string | null;
  preferredAt: Date;
  alternateAt: Date | null;
  createdAt: Date;
};

// Formatted in the business zone, passed down from the server: rendering on the
// server (UTC) and again in the browser must agree, and both must say Perth.
const hhmm = (d: Date, tz?: string) => d.toLocaleTimeString("en-AU", { timeZone: tz, hour: "numeric", minute: "2-digit" });
const clashLine = (c: Clash, tz?: string) =>
  `${c.jobNumber ?? "Internal"} · ${c.kind.toLowerCase()} ${hhmm(c.startAt, tz)} to ${hhmm(c.endAt, tz)}`;

const whenIn = (d: Date, tz?: string) =>
  d.toLocaleString("en-AU", {
    timeZone: tz,
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  });

export function BookingRow({
  req,
  label,
  clashes,
  duplicates,
  timeZone,
}: {
  req: Req;
  label: string;
  clashes: { preferred: Clash[]; alternate: Clash[] };
  duplicates: Twin[];
  timeZone?: string;
}) {
  const when = (d: Date) => whenIn(d, timeZone);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [useAlternate, setUseAlternate] = useState(false);

  // Set when the server says this time clashes; accepting again confirms.
  const [confirm, setConfirm] = useState<Clash[] | null>(null);

  const chosen = useAlternate && req.alternateAt ? req.alternateAt : req.preferredAt;
  const chosenClashes = useAlternate ? clashes.alternate : clashes.preferred;

  const accept = (confirmConflicts: boolean) =>
    start(async () => {
      setMsg(null);
      const res = await acceptBooking(req.id, chosen.toISOString(), confirmConflicts);
      if (!res.ok) {
        if (res.needsConfirmation) {
          setConfirm(res.conflicts);
          return;
        }
        setConfirm(null);
        setMsg({ tone: "bad", text: res.reason });
        return;
      }
      // Accepting removes this row from the pending list, which unmounts
      // this component, so the confirmation cannot live here. Put it in
      // the URL and let the page show it.
      const q = new URLSearchParams({
        accepted: res.jobNumber,
        at: chosen.toISOString(),
        calendar: res.calendar,
      });
      router.replace(`/bookings?${q}`);
    });

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{req.name}</span>
            <Pill tone="good">{label}</Pill>
            {chosenClashes.length ? <Pill tone="busy">clashes with your diary</Pill> : null}
            {duplicates.length ? <Pill tone="busy">possible duplicate</Pill> : null}
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {req.phone}
            {req.email ? ` · ${req.email}` : ""} · {req.suburb}
          </div>
          {req.notes ? <p className="mt-2 max-w-xl text-sm">{req.notes}</p> : null}
          {duplicates.length ? (
            <p className="mt-2 max-w-xl text-xs text-ink-2">
              Same phone as {duplicates.length === 1 ? "another request" : `${duplicates.length} other requests`} in
              the last 30 days:{" "}
              {duplicates.map((d) => `${d.status.toLowerCase()}, asked ${when(d.createdAt)}`).join("; ")}.
            </p>
          ) : null}
        </div>

        <div className="text-right text-sm">
          <div className="font-semibold tabular-nums">{when(req.preferredAt)}</div>
          {req.alternateAt ? (
            <button
              type="button"
              onClick={() => {
                setUseAlternate((v) => !v);
                setConfirm(null);
              }}
              className={`mt-1 block text-xs underline-offset-4 hover:underline ${
                useAlternate ? "font-semibold text-rose" : "text-ink-2"
              }`}
            >
              {useAlternate ? "using backup:" : "backup:"} {when(req.alternateAt)}
            </button>
          ) : null}
          <div className="mt-1 text-xs text-muted">asked {when(req.createdAt)}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => accept(false)}
          className="rounded-full bg-rose px-5 py-2 text-xs font-semibold text-white transition hover:bg-rose-deep disabled:opacity-60"
        >
          {pending ? "Working…" : `Accept ${when(chosen)}`}
        </button>

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              const res = await declineBooking(req.id);
              setMsg(res.ok ? { tone: "ok", text: "Declined." } : { tone: "bad", text: res.reason });
            })
          }
          className="rounded-full border border-line bg-white px-5 py-2 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose disabled:opacity-60"
        >
          Decline
        </button>

        <a
          href={`tel:${req.phone.replace(/\s/g, "")}`}
          className="rounded-full border border-line bg-white px-5 py-2 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose"
        >
          Ring them
        </a>
      </div>

      {confirm ? (
        <div role="alert" className="mt-4 rounded-[18px] border border-rose bg-blush px-5 py-4 text-sm">
          <b>{when(chosen)} clashes with your diary:</b>
          <ul className="mt-2 list-disc pl-5 text-xs">
            {confirm.map((c) => (
              <li key={c.eventId}>
                {clashLine(c, timeZone)}
                {c.people.length ? ` · ${c.people.join(", ")}` : ""}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => accept(true)}
              className="rounded-full bg-rose px-5 py-2 text-xs font-semibold text-white transition hover:bg-rose-deep disabled:opacity-60"
            >
              {pending ? "Working…" : "Book it anyway"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setConfirm(null)}
              className="rounded-full border border-line bg-white px-5 py-2 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}

      {msg ? (
        <p
          role="status"
          className={`mt-3 rounded-xl px-4 py-2 text-xs ${
            msg.tone === "ok" ? "bg-blush-2 text-ink" : "border border-rose bg-blush"
          }`}
        >
          {msg.text}
        </p>
      ) : null}
    </div>
  );
}
