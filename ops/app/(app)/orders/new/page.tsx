import type { Metadata } from "next";
import Link from "next/link";

import { NewJobForm } from "@/components/new-job-form";
import { PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/guard";
import { listClientOptions, recentStoneLines } from "@/lib/queries/orders";
import { listMaterialOptions } from "@/lib/queries/stock";
import { SUBURBS } from "@/lib/suburbs";

export const metadata: Metadata = { title: "New job" };

/**
 * Open a job by hand. Admin only: who the client is and what stone it is in
 * are the office's call, like the quote.
 */
export default async function NewJobPage() {
  await requireAdmin();
  const [clients, materials, pastStone] = await Promise.all([
    listClientOptions(),
    listMaterialOptions(),
    recentStoneLines(),
  ]);
  const suburbs = SUBURBS.map((s) => s.name).sort((a, b) => a.localeCompare(b));

  return (
    <>
      <Link href="/orders" className="text-sm text-ink-2 underline-offset-4 hover:text-rose hover:underline">
        ← Back to orders
      </Link>
      <div className="mt-5">
        <PageHead
          eyebrow="Opening a job"
          title={<>new job</>}
          lede="Who the client is, where the work is, and the stone if it is chosen yet. It starts at Initial Stage like any other job."
        />
      </div>
      <NewJobForm clients={clients} materials={materials} suburbs={suburbs} pastStone={pastStone} />
    </>
  );
}
