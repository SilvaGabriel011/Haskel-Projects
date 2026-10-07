import type { Metadata } from "next";

import { AddPerson } from "@/components/add-person";
import { CalendarTest } from "@/components/calendar-test";
import { PageHead } from "@/components/page-head";
import { StaffRow } from "@/components/staff-row";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { demoModeEnabled, workspaceDomain } from "@/lib/access-config";
import { requireAdmin } from "@/lib/guard";
import { recentActivity } from "@/lib/activity";
import { calendarId, calendarMissing, serviceAccount } from "@/lib/google-calendar";
import { mailConfigured } from "@/lib/mail";
import { formatDate } from "@/lib/business-time";
import { CURRENT, RELEASES, releaseDate } from "@/lib/releases";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const me = await requireAdmin();

  const [rows, domain, demo, activity] = await Promise.all([
    db.user.findMany({
      select: { id: true, email: true, name: true, role: true, active: true, pinHash: true },
      orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    Promise.resolve(workspaceDomain()),
    Promise.resolve(demoModeEnabled()),
    recentActivity(50),
  ]);
  const staff = rows.map(({ pinHash, ...u }) => ({ ...u, hasPin: pinHash !== null }));

  // Logins in use, and who is on each: two or more active makes it shared.
  const logins = [...new Set(staff.map((s) => s.email))].map((email) => ({
    email,
    names: staff.filter((s) => s.email === email && s.active).map((s) => s.name),
  }));
  const isShared = (email: string) => (logins.find((l) => l.email === email)?.names.length ?? 0) > 1;

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
            <StaffRow
              key={u.id}
              user={u}
              isSelf={u.id === me.id}
              shared={isShared(u.email)}
              lastAdmin={u.active && u.role === "ADMIN" && admins === 1}
            />
          ))}
        </Card>
        <Card className="mt-4">
          <div className="border-b border-line px-5 py-4">
            <div className="text-sm font-semibold">Add a person</div>
            <div className="text-xs text-ink-2">
              With their own email, or one already in use such as info@: several people can share a login,
              each with their own role and PIN.
            </div>
          </div>
          <AddPerson logins={logins.filter((l) => l.names.length > 0)} />
        </Card>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          An employee sees stock, offcuts, orders and their own schedule, and no money anywhere.
          An admin sees everything. You cannot remove your own admin or deactivate yourself, and
          the last admin cannot be demoted — otherwise nobody could reach the money again.
        </p>
      </section>

      <section className="mt-10" id="activity">
        <SectionTitle aside={<span className="text-xs text-ink-2">latest {activity.length}</span>}>
          Activity
        </SectionTitle>
        <Card className="divide-y divide-line">
          {activity.length === 0 ? (
            <div className="px-5 py-4 text-sm text-ink-2">Nothing recorded yet.</div>
          ) : (
            activity.map((a) => (
              <div key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
                <div className="min-w-0">
                  {a.href ? (
                    <a href={a.href} className="font-semibold underline-offset-4 hover:text-rose hover:underline">
                      {a.summary}
                    </a>
                  ) : (
                    <span className="font-semibold">{a.summary}</span>
                  )}
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-ink-2">
                    <span>
                      <span className="text-muted">user</span> {a.userName}
                    </span>
                    <span>
                      <span className="text-muted">owner</span> {a.ownerEmail}
                    </span>
                  </div>
                </div>
                <time dateTime={a.at.toISOString()} className="text-xs tabular-nums text-ink-2">
                  {formatDate(a.at, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </time>
              </div>
            ))
          )}
        </Card>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          Every change is put down to two people: the owner, the login that was signed in, and the user, the
          person on it who did it. On a shared login like info@ they differ; on someone&rsquo;s own login they
          are the same.
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
              <div className="text-sm font-semibold">Email (PIN reset codes)</div>
              <div className="text-xs text-ink-2">
                {mailConfigured()
                  ? `On. "Forgot PIN?" emails a one-time code to the shared login, from ${process.env.MAIL_FROM}.`
                  : "Not set up: RESEND_API_KEY and MAIL_FROM. Until then a forgotten PIN is reset by an admin, above."}
              </div>
            </div>
            {mailConfigured() ? <Pill tone="good">on</Pill> : <Pill tone="warn">not set up</Pill>}
          </div>

          <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">Google Calendar sync</div>
              <div className="text-xs text-ink-2">
                {calendarMissing().length === 0 ? (
                  <>
                    Set up. Accepted bookings are written to{" "}
                    <span className="font-semibold text-ink">{calendarId()}</span> by{" "}
                    <span className="font-semibold text-ink">{serviceAccount()?.clientEmail}</span>. Send a test
                    event to check the calendar is shared with it.
                  </>
                ) : (
                  <>
                    Not connected: {calendarMissing().join(", ")} {calendarMissing().length === 1 ? "is" : "are"} not
                    set. Bookings live here only until it is.
                  </>
                )}
              </div>
              {calendarMissing().length === 0 ? <CalendarTest /> : null}
            </div>
            {calendarMissing().length === 0 ? <Pill tone="good">set up</Pill> : <Pill tone="warn">not connected</Pill>}
          </div>
        </Card>
        <p className="mt-3 max-w-2xl text-xs text-muted">
          These are environment settings, not switches — they change where the app is deployed, not
          from this page. <code className="rounded bg-sand px-1.5 py-0.5">ops/README.md</code> has
          the steps.
        </p>
      </section>

      <section id="version" className="mt-10 scroll-mt-6">
        <SectionTitle aside={<Pill tone="good">v{CURRENT.version}</Pill>}>Version and changes</SectionTitle>
        <p className="max-w-2xl text-sm text-ink-2">
          Haskel Ops {CURRENT.version}, released {releaseDate(CURRENT.date)}. Every update, newest first:
        </p>
        <ol className="mt-4 grid max-w-3xl gap-3">
          {RELEASES.map((r) => (
            <li key={r.version}>
              <Card className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="font-semibold">
                    {r.title}
                    <span className="ml-2 text-xs font-normal tabular-nums text-ink-2">{r.version}</span>
                  </div>
                  <span className="text-xs text-ink-2">{releaseDate(r.date)}</span>
                </div>
                <ul className="mt-2 grid gap-1 text-sm text-ink-2">
                  {r.items.map((item) => (
                    <li key={item.text} className="flex gap-2">
                      <span aria-hidden="true">•</span>
                      <span>
                        {item.text}
                        {item.roles?.length === 1 ? (
                          <span className="ml-2 text-[0.62rem] font-bold uppercase tracking-[0.1em] text-muted">
                            {item.roles[0] === "ADMIN" ? "Admins" : "Employees"}
                          </span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
