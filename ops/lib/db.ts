/**
 * Prisma client singleton.
 *
 * Prisma 7 takes a driver adapter rather than a URL. Next's dev server reloads
 * modules on every edit, so the client is cached on globalThis to avoid opening
 * a new pool per reload and exhausting connections.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
    );
  }
  // On Supabase this should be the POOLED url (port 6543); migrations use the
  // direct one (5432) via prisma.config.ts.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
