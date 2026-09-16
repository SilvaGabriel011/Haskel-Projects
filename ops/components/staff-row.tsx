"use client";

import { useState, useTransition } from "react";

import { setActive, setRole } from "@/app/(app)/settings/actions";
import { Pill } from "@/components/ui";
import type { Role } from "@/lib/roles";

export function StaffRow({
  user,
  isSelf,
}: {
  user: { id: string; email: string; name: string; role: Role; active: boolean };
  isSelf: boolean;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

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
          </div>
          <div className="truncate text-xs text-ink-2">{user.email}</div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(["ADMIN", "EMPLOYEE"] as const).map((r) => (
            <button
              key={r}
              type="button"
              disabled={pending || user.role === r}
              onClick={() => run(() => setRole(user.id, r))}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition disabled:cursor-default ${
                user.role === r
                  ? "border-rose bg-rose text-white"
                  : "border-line bg-white text-ink-2 hover:border-rose hover:text-rose disabled:opacity-50"
              }`}
            >
              {r === "ADMIN" ? "Admin" : "Employee"}
            </button>
          ))}

          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => setActive(user.id, !user.active))}
            className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-semibold text-ink-2 transition hover:border-rose hover:text-rose disabled:opacity-50"
          >
            {user.active ? "Deactivate" : "Reactivate"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-xl border border-rose bg-blush px-4 py-2 text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}
