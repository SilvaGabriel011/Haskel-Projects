import Link from "next/link";

/** Status pill. Tone carries meaning, not decoration. */
export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "good" | "warn" | "busy" | "neutral" | "gone";
}) {
  const tones = {
    good: "bg-blush text-rose",
    warn: "bg-[#fbeada] text-[#96581c]",
    busy: "bg-[#e6eef7] text-[#2f5b8a]",
    neutral: "bg-sand text-ink-2",
    gone: "bg-[#f2f0f0] text-muted",
  } as const;
  return (
    <span
      className={`inline-block rounded-full px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.12em] whitespace-nowrap ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

/** A headline number. Used sparingly — only where the figure is the point. */
export function Tile({
  label,
  value,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className="mt-2 text-3xl font-extrabold tracking-tight tabular-nums">{value}</div>
      {sub ? <div className="mt-1 text-xs text-ink-2">{sub}</div> : null}
    </>
  );
  const cls = "rounded-[18px] border border-line bg-white p-5 block";
  return href ? (
    <Link href={href} className={`${cls} transition hover:-translate-y-0.5 hover:border-rose hover:shadow-lg`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-[18px] border border-line bg-white ${className}`}>{children}</div>;
}

export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{children}</h2>
      {aside}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-dashed border-line bg-white/60 p-10 text-center text-sm text-ink-2">
      {children}
    </div>
  );
}

/** Filter chips that drive the page through the query string. */
export function FilterChips({
  options,
  current,
  param,
  basePath,
}: {
  options: ReadonlyArray<{ value: string; label: string; count?: number }>;
  current?: string;
  param: string;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {[{ value: "", label: "All" }, ...options].map((o) => {
        const active = (current ?? "") === o.value;
        const href = o.value ? `${basePath}?${param}=${encodeURIComponent(o.value)}` : basePath;
        return (
          <Link
            key={o.value || "all"}
            href={href}
            aria-current={active ? "true" : undefined}
            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
              active
                ? "border-rose bg-rose text-white"
                : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose"
            }`}
          >
            {o.label}
            {typeof o.count === "number" ? (
              <span className={`ml-2 tabular-nums ${active ? "text-white/70" : "text-muted"}`}>{o.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}

export const mm = (n: number) => `${n.toLocaleString("en-AU")} mm`;
export const dims = (w: number, l: number) => `${w.toLocaleString("en-AU")} × ${l.toLocaleString("en-AU")} mm`;
export const sqm = (w: number, l: number) => `${((w / 1000) * (l / 1000)).toFixed(2)} m²`;

export function when(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}
