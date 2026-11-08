import type { PluginDefinition } from '@sva/plugin-sdk';
import { pluginSearch as descriptor } from './descriptor.js';
import { SearchHeader } from './header.js';
import { SearchResultsPage } from './search-page.js';
export { SearchHeader } from './header.js';
export { SearchResultsPage } from './search-page.js';
export { searchAccessRequirement } from './descriptor.js';
export const pluginViewBindings = [
  { bindingKey: 'searchHeader', component: SearchHeader },
] as const;
export const pluginSearch: PluginDefinition = {
  ...descriptor,
  routes: descriptor.routes.map((route) => ({ ...route, component: SearchResultsPage })),
};
