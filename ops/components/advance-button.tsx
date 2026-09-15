"use client";

import { useState, useTransition } from "react";

import { advanceOrder } from "@/app/(app)/orders/actions";
import type { OrderStatus } from "@prisma/client";

/**
 * Moves a job to its next stage. The server decides whether it is allowed —
 * this only shows the answer, including the reason when it is refused.
 */
export function AdvanceButton({
  orderId,
  to,
  label,
}: {
  orderId: string;
  to: OrderStatus;
  label: string;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await advanceOrder(orderId, to);
            if (!res.ok) setError(res.reason);
          })
        }
        className="rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-deep disabled:opacity-60"
      >
        {pending ? "Moving…" : label}
      </button>
      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-rose">
          {error}
        </p>
      ) : null}
    </div>
  );
}
