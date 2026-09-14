import type { Metadata } from "next";

import { ComingIn, PageHead } from "@/components/page-head";
import { requireAccess } from "@/lib/guard";

export const metadata: Metadata = { title: "stock" };

export default async function Page() {
  await requireAccess("/stock");

  return (
    <>
      <PageHead eyebrow="Slabs, offcuts and consumables" title={<>stock</>} lede="Everything on the rack and in the shed, with a movement log showing who moved what and when." />
      <ComingIn phase="Phase 3" items={["Rack list — every slab, filtered by material and status", "Slab detail — dimensions, history, photos", "Consumables with reorder points and low-stock alerts", "Receive and consume, written to the movement log", "Cost price and stock value (admin only)"]} />
    </>
  );
}
