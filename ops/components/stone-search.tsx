"use client";

import { useId, useMemo, useState } from "react";

import { canAddStone, searchStones, type StoneChoice } from "@/lib/stone-search";

type Item =
  | { key: string; group: string; type: "pick"; choice: StoneChoice; count?: number }
  | { key: string; group: string; type: "add"; name: string };

/**
 * One box to find any stone by typing. Empty, it offers the stones picked
 * most recently and most often; typing narrows every stone the form knows;
 * a name on no list can be added as it is.
 *
 * A combobox in the ARIA sense: arrows move through the list, Enter picks,
 * Escape closes, and the focus stays in the box throughout.
 */
export function StoneSearch({
  choices,
  recent,
  most,
  onPick,
  onAdd,
  className,
}: {
  choices: readonly StoneChoice[];
  recent: readonly StoneChoice[];
  most: ReadonlyArray<StoneChoice & { count: number }>;
  onPick: (c: StoneChoice) => void;
  onAdd: (name: string) => void;
  className: string;
}) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const items = useMemo<Item[]>(() => {
    const typed = query.trim();
    if (!typed) {
      return [
        ...recent.map((c) => ({ key: `r:${c.value}`, group: "Recently chosen", type: "pick" as const, choice: c })),
        ...most.map((c) => ({
          key: `m:${c.value}`,
          group: "Most chosen",
          type: "pick" as const,
          choice: c,
          count: c.count,
        })),
      ];
    }
    const found: Item[] = searchStones(choices, typed).map((c) => ({
      key: `s:${c.value}`,
      group: "Matches",
      type: "pick",
      choice: c,
    }));
    if (canAddStone(choices, typed)) {
      found.push({ key: "add", group: "Not on the list", type: "add", name: typed.replace(/\s+/g, " ") });
    }
    return found;
  }, [query, choices, recent, most]);

  const shown = open && items.length > 0;
  const at = Math.min(active, items.length - 1);

  function choose(item: Item) {
    if (item.type === "add") onAdd(item.name);
    else onPick(item.choice);
    setQuery("");
    setOpen(false);
    setActive(0);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (Math.min(a, items.length - 1) + step + items.length) % Math.max(items.length, 1));
    } else if (e.key === "Enter") {
      // Pick, and never submit the whole form from the search box.
      e.preventDefault();
      if (shown) choose(items[at]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const optionId = (i: number) => `${id}-opt-${i}`;

  return (
    <div className="relative">
      <input
        id="stoneSearch"
        type="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown ? optionId(at) : undefined}
        autoComplete="off"
        className={className}
        value={query}
        placeholder={recent.length ? "Type a colour or brand, or pick a recent one" : "Type a colour or brand"}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {shown ? (
        <ul
          id={`${id}-list`}
          role="listbox"
          aria-label="Stones"
          className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-line bg-white py-2 shadow-lg"
        >
          {items.map((item, i) => {
            const heading = i === 0 || items[i - 1].group !== item.group;
            return (
              <li key={item.key} role="presentation">
                {heading ? (
                  <p
                    role="presentation"
                    className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-muted"
                  >
                    {item.group}
                  </p>
                ) : null}
                <div
                  id={optionId(i)}
                  role="option"
                  aria-selected={i === at}
                  // Keep the focus in the box, so the blur does not close the list first.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(item)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm ${
                    i === at ? "bg-blush" : ""
                  }`}
                >
                  {item.type === "add" ? (
                    <span>
                      Add <b>“{item.name}”</b> as a new stone
                    </span>
                  ) : (
                    <>
                      <span>
                        <span className="font-semibold text-ink">{item.choice.name}</span>
                        <span className="block text-xs text-ink-2">{item.choice.hint}</span>
                      </span>
                      {item.count ? <span className="shrink-0 text-xs text-ink-2">{item.count} jobs</span> : null}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {open && query.trim() && !items.length ? (
        <p className="mt-2 text-xs text-ink-2">Nothing matches. Keep typing to add it as a new stone.</p>
      ) : null}
    </div>
  );
}
