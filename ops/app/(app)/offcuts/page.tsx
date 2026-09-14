import type { Metadata } from "next";

import { ComingIn, PageHead } from "@/components/page-head";
import { requireAccess } from "@/lib/guard";

export const metadata: Metadata = { title: "offcuts" };

export default async function Page() {
  await requireAccess("/offcuts");

  return (
    <>
      <PageHead eyebrow="What is on the rack" title={<>offcuts</>} lede="The remnants that pay the bills. What is available, what is reserved, and what came off which slab." />
      <ComingIn phase="Phase 3" items={["This week on the rack, matching the public offcuts page", "Dimensions, thickness, finish and parent slab", "Mark a piece reserved against a job", "Suggest offcuts that fit an enquiry", "Offcut yield — value recovered from remnant (admin only)"]} />
    </>
  );
}
