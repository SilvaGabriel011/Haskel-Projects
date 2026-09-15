import { defineConfig, env } from "prisma/config";

/**
 * Prisma 7 moved connection URLs out of schema.prisma into this file.
 *
 * DATABASE_URL is what migrations and the seed run against. On Supabase that
 * must be the DIRECT connection (port 5432), not the pooled one (6543) —
 * migrations need a real session and fail through pgbouncer. The application
 * itself uses the pooled URL, passed to the adapter in lib/db.ts.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});
