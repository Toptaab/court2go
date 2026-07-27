/** @type {import('next').NextConfig} */
const nextConfig = {
  // @repo/types is authored ESM workspace TS source (its package.json is
  // `type: module`, `main`/`exports` point straight at `src/index.ts`).
  // Next transpiles workspace packages listed here instead of expecting a
  // prebuilt dist — this is the only wiring @repo/types needs on the web
  // side (contrast with apps/api's ts-node CJS `moduleTypes` override,
  // which is a CommonJS-Nest-only concern and does not apply here).
  transpilePackages: ['@repo/types'],
};

export default nextConfig;
