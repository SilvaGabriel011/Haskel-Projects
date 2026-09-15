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
  // Everything except Next internals, the auth endpoints and static files.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
