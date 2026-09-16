import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/auth";
import { DemoBanner } from "@/components/demo-banner";
import { demoModeEnabled, listStaff, workspaceDomain, type Staff } from "@/lib/staff";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const { error } = await searchParams;
  const demo = demoModeEnabled();
  const domain = workspaceDomain();

  return (
    <>
      <DemoBanner />
      <main className="min-h-dvh grid lg:grid-cols-[1.1fr_1fr]">
      {/* Left: the brand side. Hidden on phones, where it is just noise. */}
      <div className="hidden lg:flex flex-col justify-between bg-ink text-white p-12">
        <div className="flex items-center gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-rose font-bold">H</div>
          <div>
            <div className="font-semibold leading-tight">Haskel Projects</div>
            <div className="text-xs tracking-widest uppercase text-white/50">Back office</div>
          </div>
        </div>

        <div>
          <h1 className="dsp text-5xl xl:text-6xl">
            small jobs and <span className="it text-blush">offcuts</span>
          </h1>
          <p className="mt-6 max-w-sm text-white/70">
            Stock on the rack, jobs in the pipeline, this week&rsquo;s installs and how the
            year is tracking — in one place.
          </p>
        </div>

        <p className="text-xs text-white/40">
          Staff only. Nothing here is visible from the public site.
        </p>
      </div>

      {/* Right: the actual sign-in. */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-rose text-white font-bold">
              H
            </div>
            <div className="font-semibold">Haskel Ops</div>
          </div>

          <h2 className="dsp text-3xl">sign in</h2>
          <p className="mt-3 text-sm text-ink-2">
            {domain
              ? `Use your @${domain} account.`
              : "Use your Haskel Projects Google account."}
          </p>

          {error ? (
            <p
              role="alert"
              className="mt-6 rounded-xl border border-rose bg-blush px-4 py-3 text-sm"
            >
              That account cannot sign in here. It must be a Haskel Projects account on the
              staff list — check with Gabriel if you think it should be.
            </p>
          ) : null}

          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/dashboard" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-full bg-rose px-6 py-4 font-semibold text-white transition hover:bg-rose-deep"
            >
              Continue with Google
            </button>
          </form>

          {demo ? <DemoSignIn staff={await listStaff()} /> : null}
        </div>
      </div>
      </main>
    </>
  );
}

/**
 * Password sign-in for the seeded demo accounts. Rendered only while
 * DEMO_MODE is true; with it off, the provider does not exist at all.
 */
function DemoSignIn({ staff }: { staff: Staff[] }) {
  return (
    <div className="mt-10 border-t border-line pt-8">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-blush px-3 py-1 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-rose">
          Demo mode
        </span>
      </div>
      <p className="mt-3 text-sm text-ink-2">
        Google sign-in is not set up yet, so the seeded accounts can be used to look
        around. Turn <code className="rounded bg-sand px-1.5 py-0.5 text-xs">DEMO_MODE</code>{" "}
        off to remove this entirely.
      </p>

      <form
        className="mt-5 flex flex-col gap-3"
        action={async (formData: FormData) => {
          "use server";
          await signIn("demo", {
            email: String(formData.get("email") ?? ""),
            password: String(formData.get("password") ?? ""),
            redirectTo: "/dashboard",
          });
        }}
      >
        <label className="text-xs font-semibold uppercase tracking-widest text-ink-2" htmlFor="demo-email">
          Email
        </label>
        <select
          id="demo-email"
          name="email"
          defaultValue={staff[0]?.email}
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm"
        >
          {staff.map((s) => (
            <option key={s.email} value={s.email}>
              {s.name} — {s.role === "ADMIN" ? "admin" : "employee"}
            </option>
          ))}
        </select>

        <label
          className="mt-2 text-xs font-semibold uppercase tracking-widest text-ink-2"
          htmlFor="demo-password"
        >
          Password
        </label>
        <input
          id="demo-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded-xl border border-line bg-white px-4 py-3 text-sm"
        />

        <button
          type="submit"
          className="mt-2 rounded-full border border-line bg-white px-6 py-3 font-semibold transition hover:border-rose hover:text-rose"
        >
          Sign in with password
        </button>
      </form>
    </div>
  );
}
