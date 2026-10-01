/**
 * Where a signed-out visit is sent, and where it lands after signing in.
 *
 * Auth.js's default is /login?callbackUrl=https%3A%2F%2Fops.haskelproject…,
 * the full address percent-encoded into the bar. Instead: a plain /login when
 * they were heading for the dashboard anyway, and a short readable
 * /login?next=/orders/abc when they followed a link deeper in.
 */

/** Paths that land on the dashboard anyway, so there is nothing to remember. */
const HOME = new Set(["/", "/dashboard"]);

export function loginUrl(requested: URL): URL {
  const url = new URL("/login", requested.origin);
  if (!HOME.has(requested.pathname)) {
    // Slashes, "?" and "=" are legal in a query value, so leave them readable;
    // "&" and "#" stay encoded or they would end the value early.
    const next = encodeURIComponent(requested.pathname + requested.search)
      .replace(/%2F/g, "/")
      .replace(/%3F/g, "?")
      .replace(/%3D/g, "=");
    url.search = `next=${next}`;
  }
  return url;
}

/**
 * Where to go after signing in. Only a path on this site: `next` arrives in
 * the address bar, so anyone can put an outside address there.
 */
export function safeNext(next: string | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    // Browsers drop tabs and newlines, so "/\t/evil.com" would become "//evil.com".
    [...next].some((c) => c.charCodeAt(0) < 0x20) ||
    next.startsWith("/login")
  ) {
    return "/dashboard";
  }
  return next;
}
