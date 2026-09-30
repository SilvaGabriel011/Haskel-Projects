"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";

/**
 * The sidebar, folded away on a phone.
 *
 * Stacked above the page, the full sidebar is about 560px of links before any
 * content — every page on a phone opened on the menu, not on the page. Below
 * the lg breakpoint it now sits behind a Menu button; from lg up it is always
 * shown, exactly as before.
 *
 * The layout persists across navigations, so a plain open/closed flag would
 * leave the menu open over the page just navigated to. It is open only on the
 * path it was opened on, so following any link closes it without an effect.
 */
export function MobileMenu({ brand, children }: { brand: React.ReactNode; children: React.ReactNode }) {
  const pathname = usePathname();
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        {brand}
        <button
          type="button"
          aria-expanded={open}
          aria-controls="app-menu"
          onClick={() => setOpenOn(open ? null : pathname)}
          className="rounded-full border border-line bg-white px-4 py-2 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose lg:hidden"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>
      <div id="app-menu" className={`${open ? "block" : "hidden"} lg:block`}>
        {children}
      </div>
    </>
  );
}
