"use client";

import { useState, useTransition } from "react";

import { setActive, setPin, setRole } from "@/app/(app)/settings/actions";
import { Pill } from "@/components/ui";
import type { Role } from "@/lib/roles";

export function StaffRow({
  user,
  isSelf,
  lastAdmin = false,
  shared = false,
}: {
  user: { id: string; email: string; name: string; role: Role; active: boolean; hasPin: boolean };
  isSelf: boolean;
  /** Others sign in with the same email, so this person picks themselves with a PIN. */
  shared?: boolean;
  /** The only active admin: demoting or deactivating them would lock everyone out. */
  lastAdmin?: boolean;
}) {
  // The server refuses these anyway. Offering a live button only to answer
  // "you cannot" is a trap; say why on the button instead.
  const locked = isSelf
    ? "You cannot demote or deactivate yourself."
    : lastAdmin
      ? "The only admin cannot be demoted or deactivated. Make someone else an admin first."
      : null;
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [pinOpen, setPinOpen] = useState(false);
  const [pin, setPinValue] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; reason?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.reason ?? "That did not work.");
    });

  return (
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{user.name}</span>
              {isSelf ? <span className="text-xs text-muted">(you)</span> : null}
              {!user.active ? <Pill tone="gone">inactive</Pill> : null}
              {shared ? <Pill>shared login</Pill> : null}
              {shared && user.active && !user.hasPin ? <Pill tone="warn">no PIN</Pill> : null}
            </div>
            <div className="truncate text-xs text-ink-2">{user.email}</div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["ADMIN", "EMPLOYEE"] as const).map((r) => {
              const blocked = r === "EMPLOYEE" && user.role === "ADMIN" && locked;
              return (
              <button
                key={r}
                type="button"
                disabled={pending || user.role === r || Boolean(blocked)}
                title={blocked || undefined}
                onClick={() => run(() => setRole(user.id, r))}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:cursor-default ${
                  user.role === r
                    ? "border-rose bg-rose text-white"
                    : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-2"
                }`}
              >
                {r === "ADMIN" ? "Admin" : "Employee"}
              </button>
            );
          })}

          <button
            type="button"
            disabled={pending || (user.active && Boolean(locked))}
            title={(user.active && locked) || undefined}
            onClick={() => run(() => setActive(user.id, !user.active))}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:text-ink-2"
          >
            {user.active ? "Deactivate" : "Reactivate"}
          </button>

          <button
            type="button"
            disabled={pending}
            onClick={() => setPinOpen((o) => !o)}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose"
          >
            {user.hasPin ? "Change PIN" : "Set PIN"}
          </button>
        </div>
      </div>

      {pinOpen ? (
        <form
          className="mt-3 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              const res = await setPin(user.id, pin);
              if (res.ok) {
                setPinOpen(false);
                setPinValue("");
              }
              return res;
            });
          }}
        >
          <label htmlFor={`pin-${user.id}`} className="text-xs text-ink-2">
            New 4-digit PIN for {user.name}
          </label>
          <input
            id={`pin-${user.id}`}
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            maxLength={4}
            value={pin}
            onChange={(e) => setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))}
            className="w-24 rounded-lg border border-line bg-white px-3 py-1.5 text-center text-sm tracking-[0.4em]"
          />
          <button
            type="submit"
            disabled={pending || pin.length !== 4}
            className="rounded-full bg-rose px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Save PIN
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-rose bg-blush px-4 py-2 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
