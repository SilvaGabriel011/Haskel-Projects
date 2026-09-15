import { signOut } from "@/auth";
import { DemoBanner } from "@/components/demo-banner";
import { Sidebar } from "@/components/sidebar";
import { requireUser } from "@/lib/guard";
import { sectionsFor } from "@/lib/roles";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const sections = sectionsFor(user.role);
  const isAdmin = user.role === "ADMIN";

  return (
    <>
      <DemoBanner />
      <div className="min-h-dvh lg:grid lg:grid-cols-[290px_1fr]">
      <aside className="border-b border-line bg-white p-5 lg:border-b-0 lg:border-r lg:min-h-dvh">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-9 h-9 rounded-lg bg-rose font-bold text-white">
            H
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Haskel Ops</div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-muted">
              Back office
            </div>
          </div>
        </div>

        <div className="mt-7">
          <Sidebar sections={sections} />
        </div>

        <div className="mt-7 border-t border-line pt-5">
          <div className="text-sm font-semibold">{user.name}</div>
          <div className="text-xs text-ink-2">{user.email}</div>
          <span
            className={[
              "mt-2 inline-block rounded-full px-3 py-1 text-[0.6rem] font-bold uppercase tracking-[0.14em]",
              isAdmin ? "bg-rose text-white" : "bg-sand text-ink-2",
            ].join(" ")}
          >
            {isAdmin ? "Admin" : "Employee"}
          </span>

          <form
            className="mt-4"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="text-xs font-semibold text-ink-2 underline underline-offset-4 hover:text-rose"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

        <main className="p-6 sm:p-10">{children}</main>
      </div>
    </>
  );
}
