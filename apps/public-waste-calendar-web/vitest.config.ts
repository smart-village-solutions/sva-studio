import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@sva/server-runtime': resolve(
        import.meta.dirname,
        '../../packages/server-runtime/src/index.ts'
      ),
      '@sva/waste-management-contracts/unsubscribe-token': resolve(
        import.meta.dirname,
        '../../packages/waste-management-contracts/src/unsubscribe-token.server.ts'
      ),
    },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
