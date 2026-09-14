/**
 * The full auth setup, Node runtime.
 *
 * Google Workspace SSO is the real sign-in. The password provider below is
 * added only while DEMO_MODE is true, so the system can be explored before
 * Google is configured; setting DEMO_MODE to anything else removes it.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import authConfig from "./auth.config";
import { verifyPassword } from "@/lib/password";
import { demoModeEnabled, findStaffByEmail } from "@/lib/staff";

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

    const staff = findStaffByEmail(email);
    if (!staff?.passwordEnv) return null;

    const stored = process.env[staff.passwordEnv];
    if (!stored) return null;

    if (!verifyPassword(password, stored)) return null;

    return { id: staff.email, email: staff.email, name: staff.name };
  },
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: demoModeEnabled()
    ? [...authConfig.providers, demoProvider]
    : authConfig.providers,
});
