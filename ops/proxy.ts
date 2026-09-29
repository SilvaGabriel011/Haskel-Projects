/**
 * Route guard, run before any page renders.
 *
 * Next 16 renamed middleware.ts to proxy.ts. It runs on the edge runtime, so
 * this uses only the edge-safe half of the auth config — the demo password
 * provider needs node:crypto and lives in auth.ts instead.
 *
 * Before the guard: a visit on the vercel.app address is sent to the company
 * domain, the only one Google sign-in accepts (lib/canonical-host.ts).
 */
import NextAuth from "next-auth";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import authConfig from "./auth.config";
import { canonicalRedirect } from "./lib/canonical-host";

const { auth } = NextAuth(authConfig);
const guard = auth as unknown as (req: NextRequest, ev: NextFetchEvent) => Promise<Response | undefined>;

export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  const target = canonicalRedirect(req.nextUrl, {
    canonicalHost: process.env.CANONICAL_HOST,
    vercelEnv: process.env.VERCEL_ENV,
  });
  if (target) return NextResponse.redirect(target, 308);
  return guard(req, ev);
}

export const config = {
  // Everything except Next internals, the auth endpoints, static files — and
  // the public booking page plus its endpoint, which are the ONE part of this
  // app a customer is meant to reach. Everything else stays behind sign-in.
  matcher: [
    "/((?!api/auth|api/book|book|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
