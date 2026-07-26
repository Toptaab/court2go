/**
 * court2go — Prisma CLI config (apps/api/prisma.config.ts).
 *
 * Prisma ORM v7 convention: `prisma validate|generate|migrate|db seed` are
 * driven by this file instead of the schema's implicit env-loading and the
 * `package.json#prisma.seed` block (both removed in v7 — see
 * https://www.prisma.io/docs/guides/upgrade-prisma-orm/v7). This file
 * configures the CLI ONLY.
 *
 * `PrismaService` (src/prisma/prisma.service.ts) does NOT read this file —
 * at runtime it connects via the `@prisma/adapter-pg` driver adapter using
 * `APP_DATABASE_URL` (the least-privilege, non-owner `app_user` role, so RLS
 * actually applies). `DATABASE_URL` below is the owner/migration role, used
 * only by `prisma migrate` / `prisma db seed`, exactly as before the v7
 * upgrade — this file changes HOW the CLI is configured, not which role it
 * uses for what.
 *
 * v7 no longer auto-loads `.env`, so it's loaded explicitly here. Secrets
 * live in ONE root `.env` (see /.env.example), not per-package, so the path
 * is resolved relative to this file rather than `process.cwd()` — CLI
 * commands work the same whether invoked from the repo root or apps/api.
 */
import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

loadEnv({ path: path.resolve(__dirname, '../../.env') });

export default defineConfig({
  schema: 'prisma/schema.prisma',

  migrations: {
    path: 'prisma/migrations',
    // Moved from package.json's `"prisma": { "seed": ... }` block (removed
    // in v7). `npm run db:seed` now runs `prisma db seed`, which reads this.
    seed: 'tsx prisma/seed.ts',
  },

  datasource: {
    url: env('DATABASE_URL'),
  },
});
