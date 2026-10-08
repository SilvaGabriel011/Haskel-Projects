"use client";

import { useState } from "react";

const OTHER = "__other";

/**
 * A dropdown that starts from known answers and still takes any other: what
 * the stone is made in first, then everything else the trade sells, then
 * "Type another…", which opens a box for anything not listed.
 *
 * The value lives with the caller, as a plain string. A value that is not in
 * either list (one typed, or one on file) shows in the box, so it is never
 * silently swapped for a listed one.
 */
export function PickOrType({
  id,
  label,
  value,
  onChange,
  madeIn,
  others = [],
  madeInLabel = "Made in",
  othersLabel = "Other options",
  format = (v) => v,
  numeric = false,
  placeholder,
  disabled,
  emptyLabel = "Pick one…",
  className,
}: {
  id: string;
  /** The field's name, for the typed-in box: "Thickness". */
  label: string;
  value: string;
  onChange: (v: string) => void;
  madeIn: readonly string[];
  others?: readonly string[];
  madeInLabel?: string;
  othersLabel?: string;
  /** How an option reads: "20" as "20 mm". */
  format?: (v: string) => string;
  /** Whole numbers only in the box. */
  numeric?: boolean;
  placeholder?: string;
  disabled?: boolean;
  emptyLabel?: string;
  className: string;
}) {
  const listed = [...madeIn, ...others];
  const inList = listed.some((x) => x.toLowerCase() === value.trim().toLowerCase());
  // Open while someone is typing, even before the first character.
  const [typing, setTyping] = useState(false);
  const custom = typing || (value !== "" && !inList);

  return (
    <div className="grid gap-2">
      <select
        id={id}
        className={className}
        disabled={disabled}
        value={custom ? OTHER : inList ? listed.find((x) => x.toLowerCase() === value.trim().toLowerCase()) : ""}
        onChange={(e) => {
          if (e.target.value === OTHER) {
            setTyping(true);
            onChange("");
          } else {
            setTyping(false);
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{emptyLabel}</option>
        {madeIn.length && others.length ? (
          <>
            <optgroup label={madeInLabel}>
              {madeIn.map((x) => (
                <option key={x} value={x}>
                  {format(x)}
                </option>
              ))}
            </optgroup>
            <optgroup label={othersLabel}>
              {others.map((x) => (
                <option key={x} value={x}>
                  {format(x)}
                </option>
              ))}
            </optgroup>
          </>
        ) : (
          listed.map((x) => (
            <option key={x} value={x}>
              {format(x)}
            </option>
          ))
        )}
        <option value={OTHER}>Type another…</option>
      </select>
      {custom && !disabled ? (
        <input
          id={`${id}Other`}
          aria-label={`${label}, typed in`}
          className={className}
          autoFocus={typing}
          inputMode={numeric ? "numeric" : undefined}
          maxLength={40}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(numeric ? e.target.value.replace(/\D/g, "").slice(0, 3) : e.target.value)}
        />
      ) : null}
    </div>
  );
}
