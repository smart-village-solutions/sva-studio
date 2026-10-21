import type { PluginDefinition } from '@sva/plugin-sdk';
import { appTranslationsPlugin as descriptor } from './descriptor.js';
import { TranslationCatalogsPage } from './catalog.page.js';
export { CatalogsPage } from './catalog.page.js';
export const appTranslationsPlugin: PluginDefinition = {
  ...descriptor,
  routes: descriptor.routes.map((route) => ({ ...route, component: TranslationCatalogsPage })),
};
