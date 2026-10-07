"use client";

import { useId, useMemo, useState } from "react";

export type SearchItem = {
  key: string;
  /** Heading the item sits under: "Recently chosen", "Matches". */
  group: string;
  /** Plain text, for the option's accessible name. */
  label: string;
  /** What the option shows; defaults to the label in bold. */
  render?: React.ReactNode;
  hint?: string;
  /** Small text on the right: "4 jobs". */
  aside?: string;
};

/**
 * A search box with a list under it: a combobox in the ARIA sense. Arrows
 * move through the list, Enter picks, Escape closes, and the focus stays in
 * the box throughout. What the list holds for a query is the caller's:
 * `itemsFor("")` is what shows before anything is typed.
 *
 * Enter never submits the form around it.
 */
export function SearchBox({
  id,
  label,
  placeholder,
  className,
  itemsFor,
  onChoose,
  empty,
}: {
  id: string;
  label: string;
  placeholder: string;
  className: string;
  itemsFor: (query: string) => SearchItem[];
  onChoose: (item: SearchItem) => void;
  /** Shown when something is typed and nothing matches. */
  empty?: string;
}) {
  const uid = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const items = useMemo(() => itemsFor(query.trim()), [itemsFor, query]);
  const shown = open && items.length > 0;
  const at = Math.min(active, items.length - 1);

  function choose(item: SearchItem) {
    onChoose(item);
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
      e.preventDefault();
      if (shown) choose(items[at]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
    }
  }

  const optionId = (i: number) => `${uid}-opt-${i}`;

  return (
    <div className="relative">
      <input
        id={id}
        type="search"
        role="combobox"
        aria-expanded={shown}
        aria-controls={`${uid}-list`}
        aria-autocomplete="list"
        aria-activedescendant={shown ? optionId(at) : undefined}
        autoComplete="off"
        className={className}
        value={query}
        placeholder={placeholder}
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
          id={`${uid}-list`}
          role="listbox"
          aria-label={label}
          className="absolute z-20 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-line bg-white py-2 shadow-lg"
        >
          {items.map((item, i) => (
            <li key={item.key} role="presentation">
              {i === 0 || items[i - 1].group !== item.group ? (
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
                aria-label={item.label}
                // Keep the focus in the box, so the blur does not close the list first.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
                className={`flex cursor-pointer items-baseline justify-between gap-3 px-4 py-2 text-sm ${
                  i === at ? "bg-blush" : ""
                }`}
              >
                <span>
                  {item.render ?? <span className="font-semibold text-ink">{item.label}</span>}
                  {item.hint ? <span className="block text-xs text-ink-2">{item.hint}</span> : null}
                </span>
                {item.aside ? <span className="shrink-0 text-xs text-ink-2">{item.aside}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      {open && query.trim() && !items.length && empty ? <p className="mt-2 text-xs text-ink-2">{empty}</p> : null}
    </div>
  );
}
