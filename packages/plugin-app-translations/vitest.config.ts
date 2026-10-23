import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  resolve: {
    alias: {
      '@sva/core/rich-text-html-policy': fileURLToPath(
        new URL('../core/src/rich-text-html-policy.ts', import.meta.url)
      ),
      '@sva/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
      '@sva/studio-ui-react': fileURLToPath(
        new URL('../studio-ui-react/src/index.ts', import.meta.url)
      ),
      '@sva/plugin-sdk/app-translations': fileURLToPath(
        new URL('../plugin-sdk/src/app-translations.ts', import.meta.url)
      ),
      '@sva/plugin-sdk/content-media': fileURLToPath(
        new URL('../plugin-sdk/src/content-media-contracts-public-api.ts', import.meta.url)
      ),
      '@sva/plugin-sdk': fileURLToPath(new URL('../plugin-sdk/src/index.ts', import.meta.url)),
    },
  },
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
});
