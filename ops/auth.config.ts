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

import { canAccess, isRole, type Role } from "@/lib/roles";

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
      }
      return session;
    },

    /**
     * The route guard. Two denials, handled differently on purpose:
     *  - not signed in        -> false, which sends them to /login
     *  - signed in, wrong role -> redirect to the dashboard carrying ?denied,
     *    so they are told why. Returning false would bounce them via /login,
     *    which would send them straight back with no explanation.
     */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      if (pathname === "/login") return true;

      const role = auth?.user?.role;
      if (!isRole(role)) return false;

      if (!canAccess(role, pathname)) {
        const url = new URL("/dashboard", request.nextUrl.origin);
        url.searchParams.set("denied", pathname);
        return NextResponse.redirect(url);
      }

      return true;
    },
  },
} satisfies NextAuthConfig;
