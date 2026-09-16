/**
 * Route guard, run before any page renders.
 *
 * Next 16 renamed middleware.ts to proxy.ts. It runs on the edge runtime, so
 * this uses only the edge-safe half of the auth config — the demo password
 * provider needs node:crypto and lives in auth.ts instead.
 */
import NextAuth from "next-auth";

import authConfig from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Everything except Next internals, the auth endpoints, static files — and
  // the public booking page plus its endpoint, which are the ONE part of this
  // app a customer is meant to reach. Everything else stays behind sign-in.
  matcher: [
    "/((?!api/auth|api/book|book|_next/static|_next/image|favicon.ico|robots.txt).*)",
  ],
};
