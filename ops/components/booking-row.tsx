"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { acceptBooking, declineBooking } from "@/app/(app)/bookings/actions";
import { Pill } from "@/components/ui";

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

const when = (d: Date) =>
  d.toLocaleString("en-AU", {
    weekday: "short", day: "numeric", month: "short",
    hour: "numeric", minute: "2-digit",
  });

export function BookingRow({ req, label }: { req: Req; label: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [useAlternate, setUseAlternate] = useState(false);

  const chosen = useAlternate && req.alternateAt ? req.alternateAt : req.preferredAt;

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{req.name}</span>
            <Pill tone="good">{label}</Pill>
          </div>
          <div className="mt-1 text-sm text-ink-2">
            {req.phone}
            {req.email ? ` · ${req.email}` : ""} · {req.suburb}
          </div>
          {req.notes ? <p className="mt-2 max-w-xl text-sm">{req.notes}</p> : null}
        </div>

        <div className="text-right text-sm">
          <div className="font-semibold tabular-nums">{when(req.preferredAt)}</div>
          {req.alternateAt ? (
            <button
              type="button"
              onClick={() => setUseAlternate((v) => !v)}
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
          onClick={() =>
            start(async () => {
              setMsg(null);
              const res = await acceptBooking(req.id, chosen.toISOString());
              if (!res.ok) {
                setMsg({ tone: "bad", text: res.reason });
                return;
              }
              // Accepting removes this row from the pending list, which unmounts
              // this component — so the confirmation cannot live here. Put it in
              // the URL and let the page show it.
              const q = new URLSearchParams({
                accepted: res.jobNumber,
                at: chosen.toISOString(),
                calendar: res.calendar,
              });
              router.replace(`/bookings?${q}`);
            })
          }
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
