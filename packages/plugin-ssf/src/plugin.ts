import type { PluginDefinition } from '@sva/plugin-sdk';

export const ssfPlugin = {
  id: 'ssf',
  displayName: 'Smart Speech Flow',
  routes: [],
  contentHistory: {
    mode: 'none',
    reasonCode: 'infrastructure_only',
  },
} as const satisfies PluginDefinition;
