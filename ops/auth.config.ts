/**
 * The edge-safe half of the auth setup.
 *
 * The middleware runs on the edge runtime, which has no node:crypto, so the
 * password provider cannot live here. This file holds Google sign-in, the
 * callbacks and the route guard; auth.ts adds the demo password provider on
 * the Node runtime.
 */
import type { NextAuthConfig } from "next-auth";
import { NextResponse } from "next/server";
import Google from "next-auth/providers/google";

import { canAccess, isRole, type Role } from "@/lib/roles";
import { findStaffByEmail, workspaceDomain } from "@/lib/staff";

export default {
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      // Ask Google to only offer accounts on the company domain. This is a
      // convenience for the user, NOT the check — the real check is signIn below,
      // because `hd` on its own can be worked around.
      authorization: {
        params: { hd: process.env.GOOGLE_WORKSPACE_DOMAIN ?? undefined, prompt: "select_account" },
      },
    }),
  ],

  pages: { signIn: "/login", error: "/login" },

  session: { strategy: "jwt" },

  callbacks: {
    /**
     * Two gates, both of which must pass: the account must be on the company
     * Workspace domain, and the person must be on the staff list. Being a
     * valid Google user is not enough.
     */
    async signIn({ user, account }) {
      if (account?.provider === "credentials") return true;

      const email = user?.email?.toLowerCase();
      if (!email) return false;

      const domain = workspaceDomain();
      if (domain && !email.endsWith(`@${domain}`)) return false;

      return findStaffByEmail(email) !== null;
    },

    /** Stamp the role onto the token once, at sign-in. */
    async jwt({ token, user }) {
      if (user?.email) {
        const staff = findStaffByEmail(user.email);
        if (staff) {
          token.role = staff.role;
          token.name = staff.name;
        }
      }
      return token;
    },

    /** Expose id/role on the session for server components to assert against. */
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub ?? token.email ?? "") as string;
        session.user.role = (isRole(token.role) ? token.role : "EMPLOYEE") as Role;
      }
      return session;
    },

    /**
     * The route guard. Runs in middleware on every matched request, before any
     * page renders.
     *
     * Two different denials, deliberately handled differently:
     *  - not signed in      -> false, which sends them to /login
     *  - signed in, wrong role -> redirect to the dashboard carrying ?denied,
     *    so they are told why. Returning false here would bounce them to
     *    /login, which would immediately send them back to the dashboard with
     *    no explanation at all.
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
