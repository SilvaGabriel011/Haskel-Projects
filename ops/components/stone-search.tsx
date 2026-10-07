"use client";

import { useCallback } from "react";

import { SearchBox, type SearchItem } from "@/components/search-box";
import { canAddStone, searchStones, type StoneChoice } from "@/lib/stone-search";

/**
 * Find any stone by typing. Empty, it offers the stones picked most recently
 * and most often; typing narrows every stone the form knows; a name on no
 * list can be added as it is.
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
  const itemsFor = useCallback(
    (typed: string): SearchItem[] => {
      const pick = (group: string, prefix: string) => (c: StoneChoice & { count?: number }): SearchItem => ({
        key: `${prefix}${c.value}`,
        group,
        label: c.name,
        hint: c.hint,
        aside: c.count ? `${c.count} jobs` : undefined,
      });
      if (!typed) return [...recent.map(pick("Recently chosen", "r:")), ...most.map(pick("Most chosen", "m:"))];
      const found = searchStones(choices, typed).map(pick("Matches", "s:"));
      if (canAddStone(choices, typed)) {
        const name = typed.replace(/\s+/g, " ");
        found.push({
          key: `add:${name}`,
          group: "Not on the list",
          label: `Add “${name}” as a new stone`,
          render: (
            <span>
              Add <b>“{name}”</b> as a new stone
            </span>
          ),
        });
      }
      return found;
    },
    [choices, recent, most],
  );

  return (
    <SearchBox
      id="stoneSearch"
      label="Stones"
      className={className}
      placeholder={recent.length ? "Type a colour or brand, or pick a recent one" : "Type a colour or brand"}
      empty="Nothing matches. Keep typing to add it as a new stone."
      itemsFor={itemsFor}
      onChoose={(item) => {
        if (item.key.startsWith("add:")) return onAdd(item.key.slice(4));
        const value = item.key.slice(2);
        const c = [...recent, ...most, ...choices].find((x) => x.value === value);
        if (c) onPick(c);
      }}
    />
  );
}
