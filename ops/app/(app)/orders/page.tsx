import type { Metadata } from "next";

import { ComingIn, PageHead } from "@/components/page-head";
import { requireAccess } from "@/lib/guard";

export const metadata: Metadata = { title: "orders" };

export default async function Page() {
  await requireAccess("/orders");

  return (
    <>
      <PageHead eyebrow="Jobs from enquiry to complete" title={<>orders</>} lede="Two pipelines: a short one for offcut and small jobs, the full run for benchtop installs." />
      <ComingIn phase="Phase 4" items={["Short pipeline — enquiry, quoted, won, cut, done", "Full pipeline — adds template, fabricate, schedule, install", "Job detail with customer, lines and cut list", "Materials priced from what is actually on the rack", "Quote, deposit and margin (admin only)"]} />
    </>
  );
}
