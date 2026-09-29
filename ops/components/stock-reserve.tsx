"use client";

import { useState, useTransition } from "react";

import { releaseFromOrder, reserveForOrder } from "@/app/(app)/orders/actions";

type Piece = { id: string; ref: string; rack: string };
type Option = Piece & { widthMm: number; lengthMm: number; material: { name: string } };

const size = (o: Option) => `${o.widthMm} × ${o.lengthMm} mm`;

/**
 * Hold stock for a job, or give it back.
 *
 * The list only offers pieces that were free when the page loaded, but that is
 * a snapshot: someone else may take one in the meantime. The server decides,
 * and when it refuses this shows why, including which job got there first.
 */
export function StockReserve({
  orderId,
  held,
  available,
}: {
  orderId: string;
  held: { offcuts: Piece[]; slabs: Piece[] };
  available: { offcuts: Option[]; slabs: Option[] };
}) {
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>, done: string) =>
    start(async () => {
      setMsg(null);
      const res = await fn();
      setMsg(res.ok ? { tone: "ok", text: done } : { tone: "bad", text: res.reason ?? "That did not work." });
      if (res.ok) setChoice("");
    });

  const heldRows = [
    ...held.offcuts.map((p) => ({ ...p, kind: "offcut" as const })),
    ...held.slabs.map((p) => ({ ...p, kind: "slab" as const })),
  ];

  return (
    <div>
      {heldRows.length ? (
        <ul className="divide-y divide-line">
          {heldRows.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <span>
                <b>{p.ref}</b> <span className="text-ink-2">· {p.kind} · rack {p.rack}</span>
              </span>
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => releaseFromOrder(orderId, p.kind, p.id), `${p.ref} released.`)}
                className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose disabled:opacity-60"
              >
                Release
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-2">Nothing held for this job yet.</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label htmlFor={`reserve-${orderId}`} className="sr-only">
          Piece to hold
        </label>
        <select
          id={`reserve-${orderId}`}
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="min-w-0 flex-1 rounded-full border border-line bg-white px-4 py-2 text-sm"
        >
          <option value="">Choose a piece to hold…</option>
          {available.offcuts.length ? (
            <optgroup label="Offcuts">
              {available.offcuts.map((o) => (
                <option key={o.id} value={`offcut:${o.id}`}>
                  {o.ref} · {o.material.name} · {size(o)} · rack {o.rack}
                </option>
              ))}
            </optgroup>
          ) : null}
          {available.slabs.length ? (
            <optgroup label="Slabs">
              {available.slabs.map((o) => (
                <option key={o.id} value={`slab:${o.id}`}>
                  {o.ref} · {o.material.name} · {size(o)} · rack {o.rack}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
        <button
          type="button"
          disabled={pending || !choice}
          onClick={() => {
            const [kind, id] = choice.split(":") as ["offcut" | "slab", string];
            run(() => reserveForOrder(orderId, kind, id), "Held for this job.");
          }}
          className="rounded-full bg-rose px-5 py-2 text-xs font-semibold text-white transition hover:bg-rose-deep disabled:opacity-60"
        >
          {pending ? "Working…" : "Hold for this job"}
        </button>
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
