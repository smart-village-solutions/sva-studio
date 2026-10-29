import { mergeConfig, defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { createPluginVitestConfig } from '../plugin-sdk/vitest-plugin-config.ts';

export default mergeConfig(
  createPluginVitestConfig({ name: 'plugin-app-translations' }),
  defineConfig({
    resolve: {
      alias: [
        {
          find: /^@sva\/plugin-sdk\/app-translations$/,
          replacement: fileURLToPath(
            new URL('../plugin-sdk/src/app-translations.ts', import.meta.url)
          ),
        },
      ],
    },
    test: {
      environment: 'happy-dom',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  })
);
