"use client";

import { useState, useTransition } from "react";

import { testCalendar } from "@/app/(app)/settings/actions";

/** Writes a test event to the calendar and deletes it again, and says how it went. */
export function CalendarTest() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <div className="mt-3">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setResult(null);
            const res = await testCalendar();
            setResult(
              res.ok
                ? { ok: true, text: "Done: a test event was written to the calendar and deleted again. Sync works." }
                : { ok: false, text: res.detail },
            );
          })
        }
        className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send a test event"}
      </button>
      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`mt-2 rounded-xl border px-4 py-2 text-xs ${result.ok ? "border-line bg-sand" : "border-rose bg-blush"}`}
        >
          {result.text}
        </p>
      ) : null}
    </div>
  );
}
