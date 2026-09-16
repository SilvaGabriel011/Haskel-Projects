/**
 * The full auth setup — Node runtime, so the database is available here.
 *
 * Google Workspace SSO is the real sign-in. The password provider is added only
 * while DEMO_MODE is true, so the system can be explored before Google is set
 * up; with it off, the provider does not exist at all.
 *
 * The signIn and jwt callbacks live here rather than in auth.config.ts because
 * they read the User table, and auth.config.ts has to stay edge-safe for the
 * middleware.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "./auth.config";
import { verifyPassword } from "@/lib/password";
import {
  demoModeEnabled,
  demoPasswordEnvFor,
  emailOnDomain,
  findStaffByEmail,
  googleSignInBlockedReason,
  workspaceDomain,
} from "@/lib/staff";

const demoProvider = Credentials({
  id: "demo",
  name: "Demo account",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    if (!demoModeEnabled()) return null;

    const email = typeof credentials?.email === "string" ? credentials.email : "";
    const password = typeof credentials?.password === "string" ? credentials.password : "";
    if (!email || !password) return null;

    const staff = await findStaffByEmail(email);
    if (!staff) return null;

    const envName = demoPasswordEnvFor(staff.email);
    const stored = envName ? process.env[envName] : undefined;
    if (!stored) return null;

    if (!verifyPassword(password, stored)) return null;

    return { id: staff.id, email: staff.email, name: staff.name };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: demoModeEnabled()
    ? [...authConfig.providers, demoProvider]
    : authConfig.providers,

  callbacks: {
    ...authConfig.callbacks,

    /**
     * Two gates, both of which must pass: the account is on the company
     * Workspace domain, and the person is an active member of staff. Being a
     * valid Google user is not enough.
     */
    async signIn({ user, account }) {
      if (account?.provider === "demo") return true;

      // Refuse outright rather than fall through unprotected.
      if (googleSignInBlockedReason()) return false;

      const email = user?.email?.toLowerCase();
      if (!email) return false;

      const domain = workspaceDomain();
      if (domain && !emailOnDomain(email, domain)) return false;

      return (await findStaffByEmail(email)) !== null;
    },

    /** Stamp id, name and role onto the token once, at sign-in. */
    async jwt({ token, user }) {
      if (user?.email) {
        const staff = await findStaffByEmail(user.email);
        if (staff) {
          token.sub = staff.id;
          token.role = staff.role;
          token.name = staff.name;
        }
      }
      return token;
    },
  },
});
