import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { SECTIONS, sectionsFor } from "@/lib/roles";
import { needsWelcome } from "@/lib/welcome";
import { whatsNewFor } from "@/lib/releases";
import { WhatsNew } from "@/components/whats-new";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;

  // Somebody new lands here after signing in: show them round first, once.
  const me = await db.user.findUnique({
    where: { id: user.id },
    select: { onboardedAt: true, seenVersion: true },
  });
  if (me && needsWelcome(me, denied)) redirect("/welcome");
  // Everyone else hears once about what changed since they last looked.
  const news = me ? whatsNewFor(me, user.role) : null;
  const isAdmin = user.role === "ADMIN";
  const sections = sectionsFor(user.role).filter((s) => s.href !== "/dashboard");
  // Read from the same list the guard uses, so this can never name the wrong
  // sections. It used to say "financials and settings" and leave out bookings.
  const hidden = SECTIONS.filter((s) => !s.allow.includes(user.role)).map((s) => s.label.toLowerCase());
  // ?denied carries a path; say the section's name, not "/bookings".
  const deniedLabel =
    SECTIONS.find((s) => denied === s.href || denied?.startsWith(`${s.href}/`))?.label ?? "That section";

  return (
    <>
      <PageHead
        eyebrow={isAdmin ? "Admin view" : "Employee view"}
        title={
          <>
            g&rsquo;day, <span className="it">{user.name.split(" ")[0].toLowerCase()}</span>
          </>
        }
        lede={
          isAdmin
            ? "You can see everything, money included."
            : "You can see the work: stock, jobs and your schedule. Pricing and margins are not shown to employees."
        }
      />

      {denied ? (
        <p
          role="alert"
          className="mt-7 max-w-2xl rounded-[22px] border border-rose bg-blush px-6 py-4 text-sm"
        >
          <b>{deniedLabel}</b> is admin only, so you were brought back here. If you think you
          should have access, ask an admin.
        </p>
      ) : null}

      {news ? <WhatsNew news={news} /> : null}

      <section className="mt-9">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          What you can open
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="rounded-[18px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-rose hover:shadow-lg"
            >
              <div className="font-semibold">{s.label}</div>
              <p className="mt-1 text-sm text-ink-2">{s.blurb}</p>
            </Link>
          ))}
        </div>
      </section>

      {hidden.length ? (
        <p className="mt-8 max-w-2xl text-sm text-ink-2">
          {listOf(hidden)} {hidden.length === 1 ? "is" : "are"} not in your list because{" "}
          {hidden.length === 1 ? "it is" : "they are"} admin only. The block is enforced on the
          server, not just hidden here.
        </p>
      ) : null}
    </>
  );
}

/** "Bookings, financials and settings", capitalised at the start. */
function listOf(words: string[]): string {
  const joined = words.length > 1 ? `${words.slice(0, -1).join(", ")} and ${words.at(-1)}` : words[0];
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}
