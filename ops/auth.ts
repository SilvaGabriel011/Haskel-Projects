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
import { record } from "@/lib/activity";
import { verifyPassword } from "@/lib/password";
import { readPickTicket } from "@/lib/pin";
import {
  demoModeEnabled,
  demoPasswordEnvFor,
  emailOnDomain,
  findPeopleByLogin,
  findStaffById,
  googleSignInBlockedReason,
  revalidateToken,
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

    // The password belongs to the login; on a shared one, who is at the
    // keyboard is asked next, with a PIN.
    const [first] = await findPeopleByLogin(email);
    if (!first) return null;

    const envName = demoPasswordEnvFor(first.email);
    const stored = envName ? process.env[envName] : undefined;
    if (!stored) return null;

    if (!verifyPassword(password, stored)) return null;

    return { id: first.id, email: first.email, name: first.name };
  },
});

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
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

      return (await findPeopleByLogin(email)).length > 0;
    },

    /**
     * At sign-in, stamp the person onto the token. On every later request,
     * re-read that person: a deactivated account gets no session, and a role
     * change applies on their next page rather than when the token expires.
     *
     * A shared login (several people on one email) signs in as no one yet:
     * the token is "pending" and every page sends them to /who to pick
     * themselves with their PIN. The pick arrives as a signed ticket
     * (lib/pin.ts), never as a bare person id, since the browser can post
     * session updates too.
     *
     * Runs on Node only. The edge proxy reads the token as it was last
     * written, so it can lag one request behind; every page and server action
     * goes through auth() here, and that is where access is decided.
     */
    async jwt({ token, user, trigger, session }) {
      if (user?.email) {
        const owner = user.email.toLowerCase();
        const people = await findPeopleByLogin(owner);
        // signIn already refused anyone not on the staff list; this closes the
        // gap if they were removed in between rather than minting a token
        // with no role.
        if (!people.length) return null;
        token.owner = owner;
        token.email = owner;
        if (people.length > 1) {
          return { ...token, sub: undefined, role: undefined, name: undefined, pending: true };
        }
        const [person] = people;
        await record({ id: person.id, name: person.name, owner }, "signed.in", "Signed in");
        return { ...token, sub: person.id, role: person.role, name: person.name, pending: false };
      }

      const owner = String(token.owner ?? token.email ?? "");

      if (trigger === "update" && session && typeof session === "object") {
        // "Switch person" on a shared login: back to picking.
        if ("switchPerson" in session && (await findPeopleByLogin(owner)).length > 1) {
          return { ...token, sub: undefined, role: undefined, name: undefined, pending: true };
        }
        const personId = "pickTicket" in session ? readPickTicket(session.pickTicket, owner) : null;
        if (personId) {
          const picked = (await findPeopleByLogin(owner)).find((p) => p.id === personId);
          if (picked) {
            return { ...token, sub: picked.id, role: picked.role, name: picked.name, owner, pending: false };
          }
        }
      }

      if (token.pending) {
        // Still the login's to pick from; gone if no one is left on it.
        return (await findPeopleByLogin(owner)).length ? token : null;
      }
      return revalidateToken(token, findStaffById);
    },
  },
});
