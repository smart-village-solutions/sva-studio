import { fileURLToPath } from 'node:url';
import { createPluginVitestConfig } from '../plugin-sdk/vitest-plugin-config.ts';
const studioMswSetupFile = fileURLToPath(new URL(import.meta.resolve('tooling-testing/msw/setup')));

export default createPluginVitestConfig({
  name: 'plugin-poi',
  extraAliases: {
    '@sva/media': '../media/src/index.ts',
  },
  setupFiles: [studioMswSetupFile],
});
