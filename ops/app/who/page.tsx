import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { DemoBanner } from "@/components/demo-banner";
import { WhoForm } from "@/components/who-form";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Who is it?" };

/**
 * After signing in with a shared login (info@…): who is at the keyboard.
 * Each person picks their name and types their PIN, and is then themselves,
 * with their own role, until they sign out or switch.
 */
export default async function WhoPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const owner = session.user.owner;

  const people = await db.user.findMany({
    where: { email: owner, active: true },
    select: { id: true, name: true, role: true, pinHash: true },
    orderBy: { name: "asc" },
  });
  // A login of one's own has nothing to pick.
  if (people.length < 2 && !session.user.pending) redirect("/dashboard");

  return (
    <>
      <DemoBanner />
      <main className="min-h-dvh grid place-items-center p-6">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-10">
            <div className="grid place-items-center w-10 h-10 rounded-xl bg-rose text-white font-bold">H</div>
            <div className="font-semibold">Haskel Ops</div>
          </div>

          <h1 className="dsp text-3xl">who is it?</h1>
          <p className="mt-3 text-sm text-ink-2">
            <span className="font-semibold text-ink">{owner}</span> is shared. Pick your name and type your
            PIN, so what you do is put down to you.
          </p>

          <WhoForm
            people={people.map((p) => ({ id: p.id, name: p.name, role: p.role, hasPin: p.pinHash !== null }))}
          />

          <form
            className="mt-8"
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button type="submit" className="text-sm text-ink-2 underline-offset-4 hover:text-rose hover:underline">
              Not {owner}? Sign out
            </button>
          </form>
        </div>
      </main>
    </>
  );
}
