import type { Role } from "@/lib/roles";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: Role;
      /** The login used: the "owner" on everything they do. */
      owner: string;
      /** Signed in on a shared login, but not yet picked who they are. */
      pending: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    owner?: string;
    pending?: boolean;
  }
}

export {};
