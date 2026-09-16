import type { Metadata } from "next";

import { PageHead } from "@/components/page-head";
import { StaffRow } from "@/components/staff-row";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { demoModeEnabled, workspaceDomain } from "@/lib/access-config";
import { requireAdmin } from "@/lib/guard";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireAdmin();

  const [staff, domain, demo] = await Promise.all([
    db.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true },
      orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    Promise.resolve(workspaceDomain()),
    Promise.resolve(demoModeEnabled()),
  ]);

  const admins = staff.filter((s) => s.active && s.role === "ADMIN").length;

  return (
    <>
      <PageHead
        eyebrow="Admin only"
        title={<>people and <span className="it">access</span></>}
        lede="Who can sign in, and what they can see once they are in."
      />

      <section className="mt-9">
        <SectionTitle aside={<span className="text-xs text-ink-2">{admins} active {admins === 1 ? "admin" : "admins"}</span>}>
          Staff
        </SectionTitle>
        <Card className="divide-y divide-line">
          {staff.map((u) => (
            <StaffRow key={u.id} user={u} isSelf={u.id === me.id} />
          ))}
        </Card>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          An employee sees stock, offcuts, orders and their own schedule, and no money anywhere.
          An admin sees everything. You cannot remove your own admin or deactivate yourself, and
          the last admin cannot be demoted — otherwise nobody could reach the money again.
        </p>
      </section>

      <section className="mt-10">
        <SectionTitle>How sign-in is set up</SectionTitle>
        <Card className="divide-y divide-line">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="text-sm font-semibold">Google Workspace domain</div>
              <div className="text-xs text-ink-2">
                {domain
                  ? `Only @${domain} accounts on the staff list can sign in.`
                  : "Not set. In production, Google sign-in is refused until it is."}
              </div>
            </div>
            {domain ? <Pill tone="good">{domain}</Pill> : <Pill tone="warn">not set</Pill>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="text-sm font-semibold">Demo password sign-in</div>
              <div className="text-xs text-ink-2">
                {demo
                  ? "On. Anyone with a demo password can sign in. Turn it off before real data goes in."
                  : "Off. Google is the only way in."}
              </div>
            </div>
            {demo ? <Pill tone="warn">on</Pill> : <Pill tone="good">off</Pill>}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div>
              <div className="text-sm font-semibold">Google Calendar sync</div>
              <div className="text-xs text-ink-2">
                Not connected. Bookings live here only; nothing is written to a calendar yet.
              </div>
            </div>
            <Pill>pending</Pill>
          </div>
        </Card>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          These are environment settings, not switches — they change where the app is deployed, not
          from this page. <code className="rounded bg-sand px-1.5 py-0.5">ops/README.md</code> has
          the steps.
        </p>
      </section>
    </>
  );
}
