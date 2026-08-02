import { createPluginVitestConfig } from '../plugin-sdk/vitest-plugin-config.ts';

export default createPluginVitestConfig({
  name: 'plugin-cockpit-cards',
  extraAliases: {
    '@sva/plugin-categories': '../plugin-categories/src/index.ts',
  },
});
