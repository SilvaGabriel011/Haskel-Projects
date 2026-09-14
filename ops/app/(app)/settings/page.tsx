import type { Metadata } from "next";

import { ComingIn, PageHead } from "@/components/page-head";
import { requireAdmin } from "@/lib/guard";

export const metadata: Metadata = { title: "settings" };

export default async function Page() {
  await requireAdmin();

  return (
    <>
      <PageHead eyebrow="People and access" title={<>settings</>} lede="Who can sign in, and what they can see." />
      <ComingIn phase="Phase 7" items={["Staff list with roles", "Make someone admin or employee", "Deactivate someone who has left", "Which Workspace domain sign-in is pinned to"]} />
    </>
  );
}
