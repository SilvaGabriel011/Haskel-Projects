/**
 * The edge-safe half of the auth setup.
 *
 * The middleware (proxy.ts) runs on the edge runtime, where Prisma and
 * node:crypto are unavailable. So this file must stay free of database access:
 * it holds the Google provider, the token-only callbacks, and the route guard.
 *
 * Anything that needs the database — checking the staff list on sign-in,
 * stamping the role onto the token — lives in auth.ts, which runs on Node.
 */
import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import Google from "next-auth/providers/google";

import { loginUrl } from "@/lib/login-url";
import { canAccess, isRole, type Role } from "@/lib/roles";

/** Where someone on a shared login picks themselves. */
const WHO = "/who";

export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // A convenience so Google offers the right account first, NOT the check —
      // the real gate is the signIn callback in auth.ts, because `hd` alone can
      // be worked around.
      authorization: {
        params: { hd: process.env.GOOGLE_WORKSPACE_DOMAIN ?? undefined, prompt: "select_account" },
      },
    }),
  ],

  pages: { signIn: "/login", error: "/login" },

  session: { strategy: "jwt" },

  callbacks: {
    /** Reads the token only — safe on the edge. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.email ?? "") as string;
        session.user.role = (isRole(token.role) ? token.role : "EMPLOYEE") as Role;
        session.user.owner = String(token.owner ?? token.email ?? "");
        session.user.pending = token.pending === true;
      }
      return session;
    },

    /**
     * The route guard. Two denials, handled differently on purpose:
     *  - not signed in        -> /login (lib/login-url.ts)
     *  - signed in, wrong role -> redirect to the dashboard carrying ?denied,
     *    so they are told why. Returning false would bounce them via /login,
     *    which would send them straight back with no explanation.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/login") return true;

      // Not signed in. Our own redirect rather than `false`, which would put
      // the whole address, percent-encoded, into ?callbackUrl.
      const role = auth?.user?.role;
      if (!auth?.user || !isRole(role)) return NextResponse.redirect(loginUrl(request.nextUrl));

      // Signed in on a shared login, but not yet said who they are: nothing
      // opens until they have. The session's role defaults to EMPLOYEE, so
      // this check comes before any role check, not after.
      if (auth.user.pending) {
        return pathname === WHO ? true : NextResponse.redirect(new URL(WHO, request.nextUrl.origin));
      }
      if (pathname === WHO) return true;

      if (!canAccess(role, pathname)) {
        const url = new URL("/dashboard", request.nextUrl.origin);
        url.searchParams.set("denied", pathname);
        return NextResponse.redirect(url);
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
