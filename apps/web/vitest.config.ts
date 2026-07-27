import { defineConfig } from 'vitest/config';

// Native Vite tsconfig-paths resolution (Vite 8+) — resolves the same
// `paths` map as `tsconfig.json` (incl. the `@repo/types` bind), so unit
// tests import the workspace contract exactly like `next build` does, no
// separate alias table to keep in sync.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
  },
});
