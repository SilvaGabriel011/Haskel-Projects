"use client";

import { useState } from "react";

import { formatAud } from "@/lib/money";

/**
 * Revenue by month, stacked by pipeline.
 *
 * Two series, so a legend is always present AND both are direct-labelled in it —
 * identity is never carried by colour alone. Palette validated: rose/blue clear
 * the CVD gate at ΔE 17.0 and the normal-vision floor at 23.8 on a white surface.
 *
 * One y-scale. Never two.
 */
export type RevenueMonth = { month: string; short: number; full: number; jobs: number };

const SERIES = [
  { key: "short" as const, label: "Offcut & small jobs", color: "#b04e6c" },
  { key: "full" as const, label: "Benchtop installs", color: "#2a78d6" },
];

export function RevenueBars({ data }: { data: RevenueMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const max = Math.max(...data.map((d) => d.short + d.full), 1);
  const W = 760;
  const H = 260;
  const PAD = { top: 16, right: 12, bottom: 30, left: 62 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / data.length;
  const barW = Math.min(band * 0.62, 44);

  // Ticks every quarter of the max, rounded to something readable.
  const step = Math.ceil(max / 4 / 100000) * 100000 || 1;
  const ticks = [0, step, step * 2, step * 3, step * 4].filter((t) => t <= max * 1.15);
  const scaleMax = ticks[ticks.length - 1] || max;
  const y = (v: number) => PAD.top + plotH - (v / scaleMax) * plotH;

  return (
    <div className="relative">
      <div className="mb-4 flex flex-wrap gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-2 text-xs font-medium">
            <i aria-hidden="true" className="inline-block h-3 w-3 rounded-sm" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue by month, split by pipeline" style={{ minWidth: 620, width: "100%", height: "auto" }}>
          {/* recessive grid */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e6dcd8" strokeWidth="1" />
              <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" style={{ fontSize: 11, fill: "#9c9294" }}>
                {t === 0 ? "0" : `$${Math.round(t / 100000)}k`}
              </text>
            </g>
          ))}

          {data.map((d, i) => {
            const cx = PAD.left + band * i + band / 2;
            const x = cx - barW / 2;
            const total = d.short + d.full;
            const shortH = (d.short / scaleMax) * plotH;
            const fullH = (d.full / scaleMax) * plotH;
            const active = hover === i;

            return (
              <g
                key={d.month + i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "default" }}
              >
                {/* hit target, larger than the mark */}
                <rect x={PAD.left + band * i} y={PAD.top} width={band} height={plotH} fill="transparent" />

                {/* stacked: short sits on the baseline with a rounded data-end;
                    full stacks above with a 2px surface gap between segments */}
                {d.short > 0 ? (
                  <rect
                    x={x}
                    y={y(d.short)}
                    width={barW}
                    height={Math.max(shortH, 1)}
                    rx={fullH > 0 ? 0 : 4}
                    fill={SERIES[0].color}
                    opacity={hover === null || active ? 1 : 0.45}
                  />
                ) : null}
                {d.full > 0 ? (
                  <rect
                    x={x}
                    y={y(total)}
                    width={barW}
                    height={Math.max(fullH - 2, 1)}
                    rx={4}
                    fill={SERIES[1].color}
                    opacity={hover === null || active ? 1 : 0.45}
                  />
                ) : null}

                <text x={cx} y={H - 10} textAnchor="middle" style={{ fontSize: 11, fill: active ? "#211d1f" : "#9c9294", fontWeight: active ? 700 : 400 }}>
                  {d.month}
                </text>
              </g>
            );
          })}

          <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="#5d5458" strokeWidth="1.5" />
        </svg>
      </div>

      {hover !== null && data[hover] ? (
        <div className="mt-3 rounded-xl border border-line bg-white px-4 py-3 text-sm shadow-sm">
          <div className="font-semibold">{data[hover].month}</div>
          <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-2">
                <i aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                {s.label} <b className="tabular-nums">{formatAud(data[hover][s.key])}</b>
              </span>
            ))}
            <span className="text-ink-2">
              {data[hover].jobs} {data[hover].jobs === 1 ? "job" : "jobs"} ·{" "}
              <b className="tabular-nums text-ink">{formatAud(data[hover].short + data[hover].full)}</b> total
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted">Hover a month for the split.</p>
      )}
    </div>
  );
}
