"use client";

import { useState } from "react";

import { pickPerson } from "@/app/who/actions";

type Person = { id: string; name: string; role: "ADMIN" | "EMPLOYEE"; hasPin: boolean };

export function WhoForm({ people }: { people: Person[] }) {
  const [picked, setPicked] = useState<string>("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const person = people.find((p) => p.id === picked);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return setError("Pick your name.");
    setBusy(true);
    setError(null);
    try {
      // On success the action redirects, and this never returns.
      const res = await pickPerson(person.id, pin);
      setError(res.reason);
      setPin("");
    } catch (err) {
      // A redirect is thrown as an error with a digest: that is success.
      if (err && typeof err === "object" && "digest" in err) throw err;
      setError("That did not go through. Check the connection and try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-6">
      <div role="radiogroup" aria-label="Who are you?" className="grid gap-2">
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={picked === p.id}
            onClick={() => {
              setPicked(p.id);
              setError(null);
            }}
            className={`flex items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
              picked === p.id ? "border-rose bg-blush" : "border-line bg-white hover:border-rose"
            }`}
          >
            <span className="font-semibold">{p.name}</span>
            <span className="text-xs text-ink-2">
              {p.role === "ADMIN" ? "Admin" : "Employee"}
              {p.hasPin ? "" : " · no PIN yet"}
            </span>
          </button>
        ))}
      </div>

      {person ? (
        <div>
          <label htmlFor="pin" className="block text-xs font-semibold uppercase tracking-widest text-ink-2">
            {person.name}&rsquo;s PIN
          </label>
          <input
            id="pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            pattern="\d{4}"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="mt-2 w-40 rounded-xl border border-line bg-white px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-rose"
            autoFocus
          />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl border border-rose bg-blush px-4 py-3 text-sm">
          {error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={busy || !person || pin.length !== 4}
          className="rounded-full bg-rose px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-deep disabled:opacity-50"
        >
          {busy ? "Checking…" : "Continue"}
        </button>
      </div>
    </form>
  );
}
