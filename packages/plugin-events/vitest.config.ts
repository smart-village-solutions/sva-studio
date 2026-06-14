import { createPluginVitestConfig } from '../plugin-sdk/vitest-plugin-config.ts';

export default createPluginVitestConfig({
  name: 'plugin-events',
  extraAliases: {
    '@sva/media': '../media/src/index.ts',
  },
});
