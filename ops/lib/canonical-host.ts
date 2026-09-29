/**
 * One address for the back office.
 *
 * Every Vercel project also answers on <project>.vercel.app. Sign-in only
 * works on the company domain (it is the one redirect URI registered with
 * Google), so a visit to the vercel.app address is sent there instead of
 * reaching a login that cannot complete.
 *
 * Production only, and only when CANONICAL_HOST is set: unset changes
 * nothing, and local development and CI are never redirected.
 */
export function canonicalRedirect(
  url: URL,
  env: { canonicalHost?: string; vercelEnv?: string },
): URL | null {
  const canonical = env.canonicalHost?.trim().toLowerCase();
  if (!canonical || env.vercelEnv !== "production") return null;

  const host = url.hostname.toLowerCase();
  if (host === canonical || !host.endsWith(".vercel.app")) return null;

  const target = new URL(url.pathname + url.search, `https://${canonical}`);
  return target;
}
