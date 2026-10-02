"use client";

import { useState, useTransition } from "react";

import { addPerson } from "@/app/(app)/settings/actions";

const field = "w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm outline-none focus:border-rose";
const label = "block text-xs font-semibold uppercase tracking-widest text-ink-2";

/**
 * Someone new who can sign in. Their own email, or one already in use, such
 * as info@, which makes it a shared login: then they need a PIN.
 */
export function AddPerson({ logins }: { logins: Array<{ email: string; names: string[] }> }) {
  const [v, setV] = useState({ name: "", email: "", role: "EMPLOYEE", pin: "" });
  const [msg, setMsg] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const onLogin = logins.find((l) => l.email === v.email.trim().toLowerCase());

  return (
    <form
      className="grid gap-4 px-5 py-5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setMsg(null);
          const res = await addPerson(v);
          if (!res.ok) return setMsg({ tone: "error", text: res.reason });
          setMsg({ tone: "ok", text: res.warning ?? `${v.name} can sign in now.` });
          setV({ name: "", email: "", role: "EMPLOYEE", pin: "" });
        });
      }}
    >
      <div>
        <label htmlFor="person-name" className={label}>Name</label>
        <input id="person-name" className={`${field} mt-2`} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="Tom Nguyen" />
      </div>
      <div>
        <label htmlFor="person-email" className={label}>Signs in with</label>
        <input
          id="person-email"
          type="email"
          list="person-logins"
          className={`${field} mt-2`}
          value={v.email}
          onChange={(e) => setV({ ...v, email: e.target.value })}
          placeholder="info@haskelproject.com.au"
        />
        <datalist id="person-logins">
          {logins.map((l) => (
            <option key={l.email} value={l.email} />
          ))}
        </datalist>
        {onLogin ? (
          <p className="mt-1 text-xs text-ink-2">
            Shared with {onLogin.names.join(", ")}. Each picks themselves with a PIN after signing in.
          </p>
        ) : null}
      </div>
      <div>
        <label htmlFor="person-role" className={label}>Role</label>
        <select id="person-role" className={`${field} mt-2`} value={v.role} onChange={(e) => setV({ ...v, role: e.target.value })}>
          <option value="EMPLOYEE">Employee</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div>
        <label htmlFor="person-pin" className={label}>PIN {onLogin ? "" : "(only for a shared login)"}</label>
        <input
          id="person-pin"
          type="password"
          inputMode="numeric"
          autoComplete="new-password"
          maxLength={4}
          className={`${field} mt-2 tracking-[0.4em]`}
          value={v.pin}
          onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, "").slice(0, 4) })}
          placeholder="4 digits"
        />
      </div>
      {msg ? (
        <p
          role={msg.tone === "error" ? "alert" : "status"}
          className={`sm:col-span-2 rounded-xl border px-4 py-2 text-sm ${msg.tone === "error" ? "border-rose bg-blush" : "border-line bg-sand"}`}
        >
          {msg.text}
        </p>
      ) : null}
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-rose px-5 py-2 text-xs font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-deep disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add person"}
        </button>
      </div>
    </form>
  );
}
