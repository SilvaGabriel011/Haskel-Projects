/**
 * Server-side role assertions.
 *
 * The middleware already blocks the route. This is the second layer, called by
 * every protected page, so that a mistake in the middleware matcher cannot on
 * its own expose a page. Both layers read the same rules from lib/roles.
 */
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { canAccess, isRole, type Role } from "@/lib/roles";

export type SignedInUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

/** The signed-in person, or a redirect to /login. Never returns null. */
export async function requireUser(): Promise<SignedInUser> {
  const session = await auth();
  const user = session?.user;

  if (!user?.email || !isRole(user.role)) {
    redirect("/login");
  }

  return {
    id: user.id ?? user.email,
    email: user.email,
    name: user.name ?? user.email,
    role: user.role,
  };
}

/** The signed-in person, provided their role may open `pathname`. */
export async function requireAccess(pathname: string): Promise<SignedInUser> {
  const user = await requireUser();

  if (!canAccess(user.role, pathname)) {
    redirect("/dashboard?denied=" + encodeURIComponent(pathname));
  }

  return user;
}

/** The signed-in person, provided they are an admin. */
export async function requireAdmin(): Promise<SignedInUser> {
  const user = await requireUser();

  if (user.role !== "ADMIN") {
    redirect("/dashboard?denied=admin");
  }

  return user;
}
