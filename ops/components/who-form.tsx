"use client";

import { useState } from "react";

import { forgotPin, pickPerson, resetPinWithCode } from "@/app/who/actions";

type Person = { id: string; name: string; role: "ADMIN" | "EMPLOYEE"; hasPin: boolean };

export function WhoForm({ people }: { people: Person[] }) {
  const [picked, setPicked] = useState<string>("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "pin": type your PIN. "reset": a code was emailed; type it and a new PIN.
  const [mode, setMode] = useState<"pin" | "reset">("pin");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [newPin, setNewPin] = useState("");
  const person = people.find((p) => p.id === picked);

  async function sendCode() {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      const res = await forgotPin(person.id);
      if (res.ok) {
        setSentTo(res.sentTo);
        setMode("reset");
      } else setError(res.reason);
    } catch {
      setError("That did not go through. Check the connection and try again.");
    }
    setBusy(false);
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      // On success the action redirects, and this never returns.
      const res = await resetPinWithCode(person.id, code, newPin);
      setError(res.reason);
    } catch (err) {
      if (err && typeof err === "object" && "digest" in err) throw err;
      setError("That did not go through. Check the connection and try again.");
    }
    setBusy(false);
  }

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
    <form onSubmit={mode === "reset" ? reset : submit} className="mt-8 grid gap-6">
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
              setMode("pin");
              setCode("");
              setNewPin("");
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

      {person && mode === "pin" ? (
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
          <button
            type="button"
            onClick={sendCode}
            disabled={busy}
            className="mt-3 block text-xs font-semibold text-ink-2 underline underline-offset-4 hover:text-rose"
          >
            {person.hasPin ? "Forgot PIN?" : "No PIN yet? Email a code to set one"}
          </button>
        </div>
      ) : null}

      {person && mode === "reset" ? (
        <div className="grid gap-4 rounded-xl border border-line bg-white p-4">
          <p className="text-sm text-ink-2">
            A 6-digit code is on its way to <span className="font-semibold text-ink">{sentTo}</span>. It works for 10
            minutes.
          </p>
          <div>
            <label htmlFor="reset-code" className="block text-xs font-semibold uppercase tracking-widest text-ink-2">
              Code from the email
            </label>
            <input
              id="reset-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-2 w-44 rounded-xl border border-line bg-white px-4 py-3 text-center text-lg tracking-[0.3em] outline-none focus:border-rose"
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="new-pin" className="block text-xs font-semibold uppercase tracking-widest text-ink-2">
              New 4-digit PIN for {person.name}
            </label>
            <input
              id="new-pin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="mt-2 w-40 rounded-xl border border-line bg-white px-4 py-3 text-center text-lg tracking-[0.5em] outline-none focus:border-rose"
            />
          </div>
          <div className="flex flex-wrap gap-4 text-xs font-semibold text-ink-2">
            <button type="button" onClick={sendCode} disabled={busy} className="underline underline-offset-4 hover:text-rose">
              Send a new code
            </button>
            <button type="button" onClick={() => setMode("pin")} className="underline underline-offset-4 hover:text-rose">
              Back to the PIN
            </button>
          </div>
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
          disabled={busy || !person || (mode === "reset" ? code.length !== 6 || newPin.length !== 4 : pin.length !== 4)}
          className="rounded-full bg-rose px-6 py-3 text-sm font-semibold text-white transition hover:bg-rose-deep disabled:opacity-50"
        >
          {busy ? "Checking…" : mode === "reset" ? "Set PIN and continue" : "Continue"}
        </button>
      </div>
    </form>
  );
}
