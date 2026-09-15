export function PageHead({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
}) {
  return (
    <header className="max-w-2xl">
      <span className="inline-block rounded-full bg-blush px-4 py-2 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-rose">
        {eyebrow}
      </span>
      <h1 className="dsp mt-5 text-4xl sm:text-5xl">{title}</h1>
      <p className="mt-4 text-ink-2">{lede}</p>
    </header>
  );
}

/** Placeholder for a module that lands in a later phase. */
export function ComingIn({ phase, items }: { phase: string; items: string[] }) {
  return (
    <section className="mt-9 rounded-[22px] border border-line bg-white p-7">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-sand px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-ink-2">
          {phase}
        </span>
        <span className="text-sm text-ink-2">Not built yet — this is the shell.</span>
      </div>
      <ul className="mt-5 grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span aria-hidden="true" className="text-rose">
              &bull;
            </span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
