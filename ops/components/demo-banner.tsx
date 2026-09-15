import { demoModeEnabled, workspaceDomain } from "@/lib/access-config";

/**
 * Demo mode and a missing domain lock are both easy to leave switched on by
 * accident. Neither is allowed to be invisible.
 */
export function DemoBanner() {
  const demo = demoModeEnabled();
  const noDomainLock = !workspaceDomain();
  if (!demo && !noDomainLock) return null;

  return (
    <div role="status" className="border-b border-rose bg-blush px-5 py-2.5 text-xs">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-1">
        {demo ? (
          <span>
            <b>Demo mode.</b> Password sign-in is enabled and the data is invented. Set{" "}
            <code className="rounded bg-white px-1.5 py-0.5">DEMO_MODE=false</code> before real
            data goes in.
          </span>
        ) : null}
        {noDomainLock ? (
          <span>
            <b>Sign-in is not domain-locked.</b> Set{" "}
            <code className="rounded bg-white px-1.5 py-0.5">GOOGLE_WORKSPACE_DOMAIN</code> so only
            your company can sign in.
          </span>
        ) : null}
      </div>
    </div>
  );
}
