"use client";

import { useState } from "react";

import { formatAud } from "@/lib/money";

/**
 * Revenue by material — magnitude across identities, so horizontal bars sorted
 * biggest first. One series, so no legend: the title names it. Every bar is
 * directly labelled, which is the secondary encoding that keeps it readable
 * without colour.
 */
export function MaterialBars({ data }: { data: Array<{ name: string; cents: number }> }) {
  const [hover, setHover] = useState<string | null>(null);
  const max = Math.max(...data.map((d) => d.cents), 1);

  return (
    <div className="flex flex-col gap-2.5">
      {data.map((d) => {
        const pct = (d.cents / max) * 100;
        const active = hover === d.name;
        return (
          <div
            key={d.name}
            onMouseEnter={() => setHover(d.name)}
            onMouseLeave={() => setHover(null)}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: "minmax(110px, 150px) 1fr auto" }}
          >
            <span className="truncate text-sm" title={d.name}>{d.name}</span>
            <span className="h-5 rounded-[4px] bg-blush-2" role="presentation">
              <span
                className="block h-full rounded-[4px] transition-opacity"
                style={{
                  width: `${Math.max(pct, 1.5)}%`,
                  background: "#b04e6c",
                  opacity: hover === null || active ? 1 : 0.45,
                }}
              />
            </span>
            <span className="text-sm font-semibold tabular-nums">{formatAud(d.cents)}</span>
          </div>
        );
      })}
    </div>
  );
}
