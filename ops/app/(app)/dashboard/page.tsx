import type { Metadata } from "next";

import { requireUser } from "@/lib/guard";
import { sectionsFor } from "@/lib/roles";
import { PageHead } from "@/components/page-head";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const isAdmin = user.role === "ADMIN";
  const sections = sectionsFor(user.role).filter((s) => s.href !== "/dashboard");

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
            ? "You can see everything, money included. This is the shell — the modules land over the next phases."
            : "You can see the work: stock, jobs and your schedule. Pricing and margins are not shown to employees."
        }
      />

      {denied ? (
        <p
          role="alert"
          className="mt-7 max-w-2xl rounded-[22px] border border-rose bg-blush px-6 py-4 text-sm"
        >
          <b>{denied === "admin" ? "That section" : denied}</b> is admin only, so you were
          brought back here. If you think you should have access, ask Gabriel.
        </p>
      ) : null}

      <section className="mt-9">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          What you can open
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sections.map((s) => (
            <a
              key={s.href}
              href={s.href}
              className="rounded-[18px] border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-rose hover:shadow-lg"
            >
              <div className="font-semibold">{s.label}</div>
              <p className="mt-1 text-sm text-ink-2">{s.blurb}</p>
            </a>
          ))}
        </div>
      </section>

      {!isAdmin ? (
        <p className="mt-8 max-w-2xl text-sm text-ink-2">
          Financials and settings are not in your list because they are admin only. The
          block is enforced on the server, not just hidden here.
        </p>
      ) : null}
    </>
  );
}
