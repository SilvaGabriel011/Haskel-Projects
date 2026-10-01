import Link from "next/link";

import { dismissWhatsNew } from "@/app/(app)/dashboard/actions";
import { releaseDate, type Release, type ReleaseItem } from "@/lib/releases";

/**
 * The one-time "What's new" card on the dashboard.
 *
 * Shows what changed since the person last looked, for their role. "Got it"
 * records the current version against them and it does not come back until
 * the next release.
 */
export function WhatsNew({ news }: { news: Array<{ release: Release; items: ReleaseItem[] }> }) {
  return (
    <section
      aria-labelledby="whats-new-title"
      className="mt-7 max-w-3xl rounded-[22px] border border-rose bg-blush px-6 py-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="whats-new-title" className="text-lg font-semibold">
          What&rsquo;s new
        </h2>
        <span className="text-xs text-ink-2">
          Version {news[0].release.version} · {releaseDate(news[0].release.date)}
        </span>
      </div>

      {news.map(({ release, items }) => (
        <div key={release.version} className="mt-3">
          {news.length > 1 ? (
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-rose">
              {release.title} · {release.version}
            </div>
          ) : null}
          <ul className="mt-2 grid gap-2 text-sm">
            {items.map((item) => (
              <li key={item.text} className="flex gap-2">
                <span aria-hidden="true" className="text-rose">•</span>
                <span>
                  {item.text}
                  {item.href ? (
                    <>
                      {" "}
                      <Link href={item.href} className="font-semibold text-rose underline-offset-4 hover:underline">
                        Show me
                      </Link>
                    </>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <form action={dismissWhatsNew} className="mt-4">
        <button
          type="submit"
          className="rounded-full bg-rose px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep"
        >
          Got it
        </button>
      </form>
    </section>
  );
}
