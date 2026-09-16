"use client";

import { useState } from "react";

import { BOOKABLE, BOOKABLE_LABEL } from "@/lib/booking";

/** Tomorrow at 9am, as a value the datetime-local input accepts. */
function defaultWhen() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const field =
  "w-full rounded-xl border border-line bg-white px-4 py-3 text-sm outline-none focus:border-rose";
const label = "block text-xs font-semibold uppercase tracking-widest text-ink-2";

export function BookingForm() {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (state === "sent") {
    return (
      <div role="status" className="rounded-[22px] border border-rose bg-blush p-8">
        <h2 className="dsp text-2xl">request sent</h2>
        <p className="mt-3 text-ink-2">
          We have your details and the time you asked for. We will ring to confirm — if that time
          does not work we will offer the closest one that does.
        </p>
        <p className="mt-4 text-sm text-ink-2">
          Nothing is booked until we have spoken, so you will not be charged or committed to
          anything before then.
        </p>
      </div>
    );
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setState("sending");

        const data = Object.fromEntries(new FormData(e.currentTarget as HTMLFormElement));
        try {
          const res = await fetch("/api/book", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
          });
          const json = await res.json();
          if (!res.ok || !json.ok) {
            setError(json.reason ?? "That did not go through. Please ring us instead.");
            setState("idle");
            return;
          }
          setState("sent");
        } catch {
          setError("That did not go through. Please ring us instead.");
          setState("idle");
        }
      }}
    >
      {/* Honeypot. Hidden from people, irresistible to bots. */}
      <div aria-hidden="true" className="absolute left-[-9999px]">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="name">Your name</label>
          <input id="name" name="name" required maxLength={80} autoComplete="name" className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="phone">Phone</label>
          <input id="phone" name="phone" required type="tel" maxLength={30} autoComplete="tel" className={`${field} mt-2`} />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="email">Email <span className="normal-case text-muted">(optional)</span></label>
          <input id="email" name="email" type="email" maxLength={120} autoComplete="email" className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="suburb">Suburb</label>
          <input id="suburb" name="suburb" required maxLength={60} className={`${field} mt-2`} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="jobType">What is the job?</label>
        <select id="jobType" name="jobType" required defaultValue="" className={`${field} mt-2`}>
          <option value="" disabled>Pick one</option>
          {BOOKABLE.map((j) => (
            <option key={j} value={j}>{BOOKABLE_LABEL[j]}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="preferredAt">When suits you?</label>
          <input id="preferredAt" name="preferredAt" required type="datetime-local" defaultValue={defaultWhen()} className={`${field} mt-2`} />
        </div>
        <div>
          <label className={label} htmlFor="alternateAt">A backup time <span className="normal-case text-muted">(optional)</span></label>
          <input id="alternateAt" name="alternateAt" type="datetime-local" className={`${field} mt-2`} />
        </div>
      </div>

      <div>
        <label className={label} htmlFor="notes">Anything else? <span className="normal-case text-muted">(optional)</span></label>
        <textarea id="notes" name="notes" rows={4} maxLength={1000} className={`${field} mt-2`}
          placeholder="Rough sizes, the stone you are after, or a photo you can send through later." />
      </div>

      {error ? (
        <p role="alert" className="rounded-xl border border-rose bg-blush px-4 py-3 text-sm">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={state === "sending"}
        className="justify-self-start rounded-full bg-rose px-8 py-4 font-semibold text-white transition hover:bg-rose-deep disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Ask for this time"}
      </button>

      <p className="text-xs text-muted">
        This is a request, not a booking. We ring to confirm before anything goes in the diary.
      </p>
    </form>
  );
}
