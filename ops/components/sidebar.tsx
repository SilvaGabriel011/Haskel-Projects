"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Section } from "@/lib/roles";

/**
 * Sidebar. It renders only the sections the signed-in role may open — but that
 * is presentation, not protection: the middleware and each page's own
 * assertion are what actually stop an employee reaching /financials.
 */
export function Sidebar({ sections }: { sections: Section[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="flex flex-col gap-1">
      {sections.map((s) => {
        const active = pathname === s.href || pathname.startsWith(`${s.href}/`);
        return (
          <Link
            key={s.href}
            href={s.href}
            aria-current={active ? "page" : undefined}
            className={[
              "rounded-xl px-4 py-3 transition",
              active
                ? "bg-blush border border-rose"
                : "border border-transparent hover:bg-blush-2",
            ].join(" ")}
          >
            <span className="block text-sm font-semibold">{s.label}</span>
            <span className="block text-xs text-ink-2">{s.blurb}</span>
          </Link>
        );
      })}
    </nav>
  );
}
