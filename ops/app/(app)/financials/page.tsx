import type { Metadata } from "next";

import { ComingIn, PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/guard";

export const metadata: Metadata = { title: "financials" };

export default async function Page() {
  await requireAdmin();

  return (
    <>
      <PageHead eyebrow="How the year is tracking" title={<>financials</>} lede="Revenue, margin and where the money actually comes from. Admin only — an employee cannot reach this page." />
      <ComingIn phase="Phase 6" items={["Revenue by month across both pipelines", "Margin per job — quote less materials less labour", "Offcut work vs full-slab work", "Quote to win rate and average job value", "Value of stock sitting on the rack"]} />
    </>
  );
}
