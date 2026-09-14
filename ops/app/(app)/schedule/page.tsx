import type { Metadata } from "next";

import { ComingIn, PageHead } from "@/components/page-head";
import { requireAccess } from "@/lib/guard";

export const metadata: Metadata = { title: "schedule" };

export default async function Page() {
  await requireAccess("/schedule");

  return (
    <>
      <PageHead eyebrow="Installs, templates and repairs" title={<>schedule</>} lede="The week ahead, and what each person is on. Bookings sync to the company Google Calendar." />
      <ComingIn phase="Phase 5" items={["Week and day views", "Drag to reschedule", "Filter by person — employees see their own by default", "My day — address and cut list for the job in front of you", "Two-way sync with the shared company calendar"]} />
    </>
  );
}
