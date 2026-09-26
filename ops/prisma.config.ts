import { defineConfig } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this file.
 *
 * This is what migrations run against. On Supabase that must be a session
 * connection (port 5432), not the transaction pooler (6543): migrations need a
 * real session and fail through pgbouncer. So DIRECT_URL when set, else
 * DATABASE_URL (fine locally, where there is only one). The application itself
 * uses the pooled DATABASE_URL, passed to the adapter in lib/db.ts.
 *
 * Read without throwing: `prisma generate` runs on install and needs no
 * database, so a missing URL must not break it.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
